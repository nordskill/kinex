class Kinex {

    static active_animations = new Map();

    /**
     * Cache for cubic-bezier easing functions keyed by the four control points.
     * Re-using the same closure keeps V8 from allocating identical functions on
     * every animation instance that shares the same easing.
     * @private
     */
    static _easing_cache = new Map();

    /**
     * A single, shared linear easing used when caller doesn't specify one.
     * Declared early so V8 can inline it everywhere.
     * @type {(t:number)=>number}
     */
    static linear = t => t;

    /**
     * Simple object-pool to recycle Kinex instances once they complete.
     * This avoids a new allocation for identical targets that get animated
     * over and over again (as in the star-field demo) and therefore reduces
     * GC churn.
     * @private
     */
    static _instance_pool = [];

    /**
     * rAF handle for the single, shared scheduler that drives *all* active
     * tweens.  Having one global loop instead of one per animation saves ~2k
     * callbacks in the performance demo and noticeably shrinks both the JS
     * heap and the task queue pressure.
     * @private {number|null}
     */
    static _raf_id = null;

    /**
     * True while the instance lives in the object pool.
     * A dedicated flag is cheaper than calling Array.includes() on every push.
     * @private {boolean}
     */
    _inPool = false;

    /**
     * Tween `target` from its current values to `endValues`.
     * @param {Object|Element|Window} target
     * @param {Object<string,number|string>} endValues  Final values.
     * @param {Object} [options]  Options including duration (defaults to 1000ms).
     * @param {number} [options.duration=1000]  Duration in milliseconds.
     * @returns {Promise & {stop():Kinex}}
     */
    static to(target, endValues, options = {}) {
        const duration = options.duration || 1000;
        return Kinex.#get_or_create_instance(target, duration, endValues, options).#animate();
    }

    /**
     * Like {@link Kinex.to} but starts from the given values and animates to
     * the target's current state.
     * @param {Object|Element|Window} target
     * @param {Object<string,number|string>} startValues  Start values.
     * @param {Object} [options]  Options including duration (defaults to 1000ms).
     * @param {number} [options.duration=1000]  Duration in milliseconds.
     * @returns {Promise & {stop():Kinex}}
     */
    static from(target, startValues, options = {}) {
        const duration = options.duration || 1000;
        const endValues = {};
        for (const prop in startValues) {
            endValues[prop] = target[prop] || 0;
        }
        return Kinex.#get_or_create_instance(target, duration, endValues, {
            ...options,
            startProperties: startValues
        }).#animate();
    }

    /**
     * Immediately stop and recycle every running animation.
     */
    static stop_all() {
        // Clone current animations to avoid mutating the Map while iterating which could
        // otherwise cause some entries to be missed on certain JS engines.
        const running = Array.from(Kinex.active_animations.values());
        for (const anim of running) {
            anim.stop();
        }
        // `.stop()` already removes each animation from the Map, but clearing guarantees
        // that no stragglers survive if a consumer mistakenly re-inserts during `stop()`.
        Kinex.active_animations.clear();
    }

    constructor(target, duration, properties, options = {}) {
        this.target = target;
        this.#reset(duration, properties, options);
        this.stop = this.stop.bind(this);
        Kinex.active_animations.set(target, this);
    }

    stop() {
        this.stopped = true;
        if (this.timeoutID != null) {
            clearTimeout(this.timeoutID);
            this.timeoutID = null;
        }
        Kinex.active_animations.delete(this.target);
        if (this.resolve) {
            this.resolve();
        }

        /*
         * BREAK ALL STRONG REFERENCES so that the GC can promptly reclaim memory,
         * especially DOM nodes (star.style) that may otherwise linger and inflate
         * the "DOM Nodes" counter in DevTools.
         */
        this.target = null;
        this.properties = null;
        this.currentValues = null;
        this.on_start = this.on_update = this.on_complete = null;

        // Make the object available for reuse if it hasn't been reclaimed yet.
        if (!this._inPool) {
            this._inPool = true;
            Kinex._instance_pool.push(this);
        }

        return this;
    }

    #reset(duration, properties, options) {
        this.duration = duration;
        this.delay = options.delay || 0;
        this.startProperties = options.startProperties || {};
        this.properties = this.#normalize_properties(properties);
        this.easing = this.#parse_easing(options.easing);
        this.on_start = options.on_start || (() => { });
        this.on_update = options.on_update || (() => { });
        this.on_complete = options.on_complete || (() => { });
        this.startTime = null;
        this.timeoutID = null;
        this.stopped = false;
        this.started = false;

        // Pre-compute reciprocal to turn division into multiplication inside the hot loop.
        this._invDuration = 1 / this.duration;

        // Reusable container for per-frame property values; avoids GC churn.
        this.currentValues = {};
    }

    static #get_or_create_instance(target, duration, properties, options) {
        let instance = Kinex.active_animations.get(target);

        if (instance) {
            // Target already has an active tween – recycle it.
            instance.stop();
            instance.target = target;
            instance.#reset(duration, properties, options);
            Kinex.active_animations.set(target, instance);
            return instance;
        }

        // Try to re-use a previously finished Kinex object from the pool.
        if (Kinex._instance_pool.length) {
            instance = Kinex._instance_pool.pop();
            instance._inPool = false;
            instance.target = target;
            instance.#reset(duration, properties, options);
            Kinex.active_animations.set(target, instance);
            return instance;
        }

        // Nothing to recycle – fall back to a fresh allocation.
        return new Kinex(target, duration, properties, options);
    }

    #parse_easing(easing) {
        // Accept cubic-bezier expressed as an array of four numbers.
        if (Array.isArray(easing) && easing.length === 4) {
            const key = easing.join(','); // e.g. "0.25,0.1,0.25,1"
            let fn = Kinex._easing_cache.get(key);
            if (!fn) {
                fn = Kinex.cubic_bezier(...easing);
                Kinex._easing_cache.set(key, fn);
            }
            return fn;
        }

        // If caller supplies a function, use it; otherwise default to linear.
        return easing || Kinex.linear;
    }

    #normalize_properties(properties) {
        return Object.entries(properties)
            .map(([name, endValue]) => {
                const start = this.startProperties[name] ?? this.#get_start_value(name, endValue);
                const parsedStart = this.#parse_value(start);
                const parsedEnd = this.#parse_value(endValue);
                const unit = this.#get_unit(endValue);
                return {
                    name,
                    start: parsedStart,
                    delta: parsedEnd - parsedStart,
                    unit,
                    needsInterpolation: parsedStart !== parsedEnd
                };
            })
            .filter(prop => prop.needsInterpolation);
    }

    #get_start_value(name, endValue) {
        if (this.target instanceof Element) {
            const currentValue = this.target.style[name];
            if (currentValue === '') {
                throw new Error(`Starting value for property "${name}" is not set.`);
            }
            return currentValue;
        }
        if (!(name in this.target)) {
            throw new Error(`Property "${name}" does not exist on the target object.`);
        }
        return this.target[name];
    }

    #parse_value(value) {
        if (typeof value === 'number') return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }

    #get_unit(value) {
        if (typeof value === 'number') return '';
        return String(value).replace(/^-?\d*\.?\d+/, '') || '';
    }

    #animate() {
        const promise = new Promise((resolve) => {
            this.resolve = resolve;

            const startAnimation = () => {
                this.started = true;
                this.startTime = performance.now();
                this.#update(this.startTime);
                Kinex.#ensure_scheduler();
            };

            const willAnimateProperties = {};

            for (const prop of this.properties) {
                if (prop.needsInterpolation) {
                    willAnimateProperties[prop.name] = prop.unit ? `${prop.start}${prop.unit}` : prop.start;
                }
            }

            this.on_start(willAnimateProperties, this);

            if (this.delay > 0) {
                this.timeoutID = setTimeout(() => {
                    this.timeoutID = null;
                    startAnimation();
                }, this.delay);
            } else {
                startAnimation();
            }
        });

        return Object.assign(promise, { stop: this.stop });
    }

    /**
     * Per-instance update run by the shared scheduler.  It is *not* in charge
     * of scheduling the next frame – that is now handled globally – which
     * means we simply compute the new state and mark ourselves complete when
     * the eased progress reaches 1.
     * @private
     */
    #update = (currentTime) => {
        if (this.stopped || !this.started) return;
        if (!this.startTime) this.startTime = currentTime;

        const initialStartTime = this.startTime;
        const progress = this.#compute_progress(currentTime);

        const currentValues = this.currentValues;
        const isDOMTarget = this.target instanceof Element; // Covers HTMLElement, SVGElement, etc.; single prototype walk

        for (const prop of this.properties) {
            const currentValue = prop.start + prop.delta * progress;
            const formattedValue = prop.unit ? `${currentValue}${prop.unit}` : currentValue;

            currentValues[prop.name] = formattedValue;

            if (isDOMTarget) {
                this.target.style.setProperty(prop.name, formattedValue);
            } else if (this.target === window && prop.name === 'scrollY') {
                window.scrollTo(0, currentValue);
            } else {
                this.target[prop.name] = formattedValue;
            }
        }

        this.on_update(currentValues, this);

        if (progress >= 1 && !this.stopped) {
            this.on_complete(currentValues, this);

            /*
             * If on_complete DID NOT restart this object (its startTime stayed
             * the same) we can safely clean it up and recycle it; otherwise the
             * tween has already been refreshed and must remain active.
             */
            const restarted = this.startTime !== initialStartTime;

            if (!restarted) {
                Kinex.active_animations.delete(this.target);

                // Avoid duplicate entries in the pool.
                if (!this._inPool) {
                    this._inPool = true;
                    Kinex._instance_pool.push(this);
                }

                this.resolve();
            }
        }
    };

    /**
     * Compute eased progress for a given frame.
     * Extracted as a tiny helper so V8 can inline it, reducing the body size of `#update`.
     * @param {number} currentTime
     * @returns {number} eased progress in the range [0,1]
     * @private
     */
    #compute_progress(currentTime) {
        const raw = (currentTime - this.startTime) * this._invDuration;
        const clamped = raw < 1 ? raw : 1; // avoid Math.min call in hot path
        return this.easing(clamped);
    }

    /**
     * Generate a cubic-bezier easing function.
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {(t:number)=>number}
     */
    static cubic_bezier(x1, y1, x2, y2) {
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;
        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;

        function sampleCurveX(t) {
            return ((ax * t + bx) * t + cx) * t;
        }

        function sampleCurveY(t) {
            return ((ay * t + by) * t + cy) * t;
        }

        function sampleCurveDerivativeX(t) {
            return (3 * ax * t + 2 * bx) * t + cx;
        }

        function solveCurveX(x, epsilon = 1e-6) {
            let t0, t1, t2, x2, d2;
            t2 = x;
            for (let i = 0; i < 8; i++) {
                x2 = sampleCurveX(t2) - x;
                if (Math.abs(x2) < epsilon) return t2;
                d2 = sampleCurveDerivativeX(t2);
                if (Math.abs(d2) < epsilon) break;
                t2 = t2 - x2 / d2;
            }
            t0 = 0;
            t1 = 1;
            t2 = x;
            if (t2 < t0) return t0;
            if (t2 > t1) return t1;
            while (t0 < t1) {
                x2 = sampleCurveX(t2);
                if (Math.abs(x2 - x) < epsilon) return t2;
                if (x > x2) t0 = t2;
                else t1 = t2;
                t2 = (t1 - t0) * 0.5 + t0;
            }
            return t2;
        }

        return function (x) {
            return sampleCurveY(solveCurveX(x));
        };
    }

    /* --------------------------------------------------------------------- */
    //  🔽  Global scheduler helpers
    /* --------------------------------------------------------------------- */

    /**
     * Kick-off the shared rAF loop if it is not already running.
     * @private
     */
    static #ensure_scheduler() {
        if (Kinex._raf_id == null) {
            Kinex._raf_id = requestAnimationFrame(Kinex.#tick);
        }
    }

    /**
     * One frame tick that advances every live animation and reschedules
     * itself as long as there is at least one active tween.
     * Using a private static method keeps it fully encapsulated while still
     * granting access to private instance fields such as #update().
     * @param {DOMHighResTimeStamp} time
     * @private
     */
    static #tick = (time) => {
        for (const anim of Kinex.active_animations.values()) {
            anim.#update(time);
        }

        // When the last animation finishes we halt the loop so the browser
        // can throttle the tab and we do not waste CPU cycles.
        if (Kinex.active_animations.size) {
            Kinex._raf_id = requestAnimationFrame(Kinex.#tick);
        } else {
            Kinex._raf_id = null;
        }
    };
}
window.kinex = Kinex;