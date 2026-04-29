# Kinex Animation Library

Kinex (Kinetic Expressions): The World's smallest and fastest JavaScript animation library, designed to meet 90% of common daily animation needs.

[Visual ease editor](https://kinex.dev/#bezier-editor)

> ⚠️ Read about the breaking changes in v2.0.0 at the end of the page. 

## Installation

```bash
npm i @nordskill/kinex
```

## Usage

You can use Kinex in your project either via ES Modules or directly in the browser.

### Use as ES Module

```javascript
import kinex from '@nordskill/kinex';
```

### Include in a Browser Environment

```html
<script src="path/to/kinex.min.js"></script>
<script>
    // kinex.to(target, endValues, options);
</script>
```

## What Can Kinex Animate?

Kinex can animate:

1. **JavaScript Object Properties**: Any numeric property of an object.
2. **HTML Element Styles**: Animates styles like `width`, `height`, `opacity`, or any other CSS property that uses simple numeric values with units (e.g., "20px", "50%"). How to animate complex CSS functions like `translate(x, y)` or `rotate()` read below.
3. **Smooth Page Scroll**: Animates the page scroll position for smoother scrolling effects.

## How to Animate?

1. `kinex.to(target, endValues, options)`
Animates the specified properties of the target to new values over a given duration.

**Parameters**:
- `target`: The object or element you want to animate.
- `endValues`: An object defining the end values for the properties to animate.
- `options`: Settings including `duration` (defaults to 1000 ms), `easing`, `delay`, and callbacks (`on_start`, `on_update`, `on_complete`).

**Minimal Examples**

**Box Style Animation**
```javascript
const box = document.querySelector('#box');

kinex.to(box.style, { borderRadius: '20px' });
```

**Generic Object Animation**
```javascript
const obj = { value: 0 };

kinex.to(obj, { value: 100 });
```

**Window Scroll Animation**
```javascript
kinex.to(window, { scrollY: 800 },
    { 
        duration: 1000,
        easing: [0.25, 0, 0, 1]
    });
```

**Full Example:**
```javascript
// Change border radius and opacity over 1 second.
// Animates with 500 milliseconds delay and easing.
const box = document.querySelector('#box');

kinex.to(box.style, { borderRadius: '20px', opacity: 1 }, {
    duration: 1000,
    delay: 500,
    easing: [0.5, 0, 0, 1],
    on_start: () => console.log('box animation starts'),
    on_update: (values) => console.log(`Current opacity is ${values.opacity}.`),
    on_complete: () => console.log('box animation is complete')
});
```

2. `kinex.from(target, startValues, options)`
Animates the properties of the target from the specified values to their current values.

**Parameters**:
- `target`: The object or element you want to animate.
- `startValues`: An object defining the starting values for the properties to animate.
- `options`: Settings including `duration` (defaults to 1000 ms), `easing`, `delay`, and callbacks (`on_start`, `on_update`, `on_complete`).

**Example:**
```javascript
// Fade in an element from 0 to its current opacity in 500 milliseconds
const circle = document.querySelector('#circle');

circle.style.opacity = 1;
kinex.from(circle.style, { opacity: 0 }, { duration: 500 });
```

3. `.stop()`
Stops an animation.

**Example:**
```javascript
// Starts and then immediately stops the animation
const box = document.querySelector('#box');
const boxAnimation = kinex.to(box.style, { opacity: 0 });
boxAnimation.stop();
```

4. `kinex.stop_all()`
Stops all running animations immediately.

**Example:**
```javascript
// Stop all animations
kinex.stop_all();
```

### Animating Object Properties or Complex CSS Styles 

Since complex CSS properties like `translate(x, y)` cannot be animated directly, you can animate an object and apply those values manually in an `on_update` callback:

**Example:**
```javascript
const position = { x: 0, y: 0 };
const element = document.querySelector('#movingElement');

// Animate x and y properties from 0 to 100 and 50 over 1 second (default duration)
kinex.to(position, { x: 100, y: 50 }, {
    on_update: ({ x, y }) => {
        // Apply the animated values to the element's transform property
        element.style.transform = `translate(${x}px, ${y}px)`;
    }
});
```

## Cubic-Bezier Easing in Kinex

Kinex supports custom easing functions using cubic Bezier curves, which allow for more complex and smooth animations. A cubic Bezier easing curve is defined by two control points, represented as four numbers that shape the curve's acceleration and deceleration over time. By specifying these points, you can create custom easing effects like ease-in, ease-out, or a combination of both.

To use cubic Bezier easing, provide an array with four numbers `[x1, y1, x2, y2]` representing the control points. For example, `[0.6, 0, 0.4, 1]` creates a smooth ease-in-out effect.

You can use the visual [Bezier Curve Editor](https://kinex.dev/#bezier-editor) to create custom control points.

**Example:**
```javascript
// Animate an element with a custom cubic Bezier easing function
kinex.to(document.querySelector('#box').style, { left: '200px' }, {
    easing: [0.42, 0, 0.58, 1] // Custom cubic Bezier easing
});
```

## Using Promises with Kinex

Kinex animations return a promise, which means you can easily run some code after the animation finishes. You can use `async/await` to make this even simpler, allowing you to wait for the animation to complete before doing something else. This is great when you want to chain animations or perform some actions in order.

**Example:**
```javascript
async function myAnimation() {

    const box = document.querySelector('#box');

    // Wait for the first animation to finish
    await kinex.to(box.style, { left: '200px' }, { duration: 1000 });
    console.log('First animation done!');

    // Start another animation after the first one is complete
    await kinex.to(box.style, { opacity: 0.5 }, { duration: 500 });
    console.log('Second animation done!');

}

myAnimation();
```

In this example, the first animation moves an element horizontally over 1 second. After it finishes, a message is logged, and then a second animation starts to change the opacity. This shows how you can run animations one after another using `async/await` in a simple way.

## Breaking Changes in v2.0.0

**⚠️ API Changes**: If you're upgrading from v1.x, please note the following breaking changes:

**Old API (v1.x):**
```javascript
kinex.to(target, duration, properties, options)
kinex.from(target, duration, properties, options)
```

**New API (v2.0.0+):**
```javascript
kinex.to(target, endValues, options)        // duration moved to options
kinex.from(target, startValues, options)    // duration moved to options
```

**Migration Guide:**
```javascript
// Before (v1.x)
kinex.to(element.style, 1000, { opacity: 1 }, { easing: [0.25, 0, 0, 1] })
kinex.from(element.style, 500, { opacity: 0 })

// After (v2.0.0+)
kinex.to(element.style, { opacity: 1 }, { duration: 1000, easing: [0.25, 0, 0, 1] })
kinex.from(element.style, { opacity: 0 }, { duration: 500 })

// Or use 1000ms default duration
kinex.to(element.style, { opacity: 1 }, { easing: [0.25, 0, 0, 1] })
kinex.from(element.style, { opacity: 0 })
```
