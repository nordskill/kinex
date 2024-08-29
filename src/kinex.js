export default class Kinex {

    static active_animations = new Map();
    
    static to(target, duration, properties, options = {}) {
        return Kinex.#get_or_create_instance(target, duration, properties, options).#animate();
    }

    static from(target, duration, properties, options = {}) {
        const startProperties = Object.fromEntries(
            Object.entries(properties).map(([prop, value]) => [prop, value])
        );
        const endProperties = Object.fromEntries(
            Object.entries(properties).map(([prop, value]) => [prop, target[prop] || 0])
        );
        return Kinex.#get_or_create_instance(target, duration, endProperties, {
            ...options,
            startProperties
        }).#animate();
    }

    static stop_all() {
        for (const animation of Kinex.active_animations.values()) {
            animation.stop();
        }
        Kinex.active_animations.clear();
    }

    constructor(target, duration, properties, options = {}) {
        this.target = target;
        this.#reset(duration, properties, options);
        this.stop = this.stop.bind(this);
    }

    stop() {
        this.stopped = true;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        Kinex.active_animations.delete(this.target);
        if (this.resolve) {
            this.resolve();
        }
        return this;
    }

    #reset(duration, properties, options) {
        this.duration = duration;
        this.delay = options.delay || 0;
        this.startProperties = options.startProperties || {};
        this.properties = this.#normalize_properties(properties);
        this.easing = this.#parse_easing(options.easing);
        this.on_start = options.on_start || (() => {});
        this.on_update = options.on_update || (() => {});
        this.on_complete = options.on_complete || (() => {});
        this.startTime = null;
        this.animationFrame = null;
        this.stopped = false;
    }

    static #get_or_create_instance(target, duration, properties, options) {
        let instance = Kinex.active_animations.get(target);
        if (instance) {
            instance.stop();
            instance.#reset(duration, properties, options);
        } else {
            instance = new Kinex(target, duration, properties, options);
            Kinex.active_animations.set(target, instance);
        }
        return instance;
    }

    #parse_easing(easing) {
        if (Array.isArray(easing) && easing.length === 4) {
            return Kinex.cubic_bezier(...easing);
        }
        return easing || (t => t); // Linear easing by default
    }

    #normalize_properties(properties) {
        return Object.entries(properties)
            .map(([name, endValue]) => {
                const start = this.startProperties[name] ?? this.#get_start_value(name, endValue);
                const parsedStart = this.#parse_value(start);
                const parsedEnd = this.#parse_value(endValue);
                return {
                    name,
                    start: parsedStart,
                    end: parsedEnd,
                    unit: this.#get_unit(endValue),
                    needsInterpolation: parsedStart !== parsedEnd
                };
            })
            .filter(prop => prop.needsInterpolation);
    }

    #get_start_value(name, endValue) {

        if (this.reversed) return endValue;
        if (this.target instanceof Element || this.target instanceof HTMLElement) {
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
                this.startTime = performance.now();
                this.#step(this.startTime);
            };

            const willAnimateProperties = {};

            for (const prop of this.properties) {
                if (prop.needsInterpolation) {
                    willAnimateProperties[prop.name] = prop.unit ? `${prop.start}${prop.unit}` : prop.start;
                }
            }

            this.on_start(willAnimateProperties, this);

            if (this.delay > 0) {
                setTimeout(startAnimation, this.delay);
            } else {
                startAnimation();
            }
        });

        return Object.assign(promise, { stop: this.stop });
    }

    #step(currentTime) {
        if (this.stopped) return;
        if (!this.startTime) this.startTime = currentTime;

        const elapsedTime = currentTime - this.startTime;
        let progress = Math.min(elapsedTime / this.duration, 1);
        progress = this.easing(progress);

        const currentValues = {};

        for (const prop of this.properties) {
            const currentValue = prop.start + (prop.end - prop.start) * progress;
            const formattedValue = prop.unit ? `${currentValue}${prop.unit}` : currentValue;

            currentValues[prop.name] = formattedValue;

            if (this.target instanceof Element || this.target instanceof HTMLElement) {
                this.target.style[prop.name] = formattedValue;
            } else if (this.target === window && prop.name === 'scrollY') {
                window.scrollTo(0, currentValue);
            } else {
                this.target[prop.name] = formattedValue;
            }
        }

        this.on_update(currentValues, this);

        if (progress < 1) {
            this.animationFrame = requestAnimationFrame(this.#step.bind(this));
        } else {
            if (!this.stopped) {
                this.on_complete(currentValues, this);
                Kinex.active_animations.delete(this.target);
                this.resolve();
            }
        }
    }

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
}