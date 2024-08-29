# Kinex Animation Library

Kinex (Kinetic Expressions): The World's smallest and fastest JavaScript animation library, designed to meet 90% of common daily animation needs.

## Installation

```bash
npm i @nordskill/kinex
```

## Usage

You can use Kinex in your project either via ES Modules or directly in the browser.

### Use as ES Module

```javascript
import kinex from 'kinex';
```

### Include in a Browser Environment

```html
<script src="path/to/kinex.min.js"></script>
<script>
    // kinex.to(target, duration, properties, options);
</script>
```

## What Can Kinex Animate?

Kinex can animate:

1. **JavaScript Object Properties**: Any numeric property of an object.
2. **HTML Element Styles**: Animates styles like `width`, `height`, `opacity`, or any other CSS property that uses simple numeric values with units (e.g., "20px", "50%"). How to animate complex CSS functions like `translate(x, y)` or `rotate()` read below.
3. **Smooth Page Scroll**: Animates the page scroll position for smoother scrolling effects.

## How to Animate?

1. `kinex.to(target, duration, properties, options)`
Animates the specified properties of the target to new values over a given duration.

**Parameters**:
- `target`: The object or element you want to animate.
- `duration`: The duration of the animation in milliseconds.
- `properties`: An object defining the end values for the properties to animate.
- `options` (optional): Additional settings like `easing`, `delay`, and callbacks (`on_start`, `on_update`, `on_complete`).

**Minimal Example**
```javascript
const box = document.querySelector('#box');

Kinex.to(box, 1000, { borderRadius: '20px' });
```

**Full Example:**
```javascript
// Move an element to a new position and change opacity over 1 second.
// Animates with 500 miliseconds delay and easing.
const box = document.querySelector('#box');

Kinex.to(box, 1000, { borderRadius: '20px', opacity: 1 }, {
    delay: 500,
    easing: [0.5, 0, 0, 1],
    on_start: () => console.log('box animation starts'),
    on_update: (values) => console.log(`Current opacity is ${values.opacity}.`),
    on_complete: () => console.log('box animation is complete')
});
```

2. `kinex.from(target, duration, properties, options)`
Animates the properties of the target from the specified values to their current values.

**Parameters**:
- Same as `kinex.to`, but properties define the starting values instead.

**Example:**
```javascript
// Fade in an element from 0 to its current opacity in 500 milliseconds
const circle = document.querySelector('#circle');

kinex.from(circle, 500, { opacity: 0 });
```

3. `.stop()`
Stops an animation.

**Example:**
```javascript
// Starts and then immediately stops the animation
const boxAnimation = kinex.to(box, 1000, { opacity: 0 });
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

// Animate x and y properties from 0 to 100 and 50 over 1 second
kinex.to(position, 1000, { x: 100, y: 50 }, {
    on_update: ({ x, y }) => {
        // Apply the animated values to the element's transform property
        element.style.transform = `translate(${x}px, ${y}px)`;
    }
});
```

## Cubic Bezier Easing in Kinex

Kinex supports custom easing functions using cubic Bezier curves, which allow for more complex and smooth animations. A cubic Bezier curve is defined by four control points that shape the curve's acceleration and deceleration over time. By specifying these points, you can create custom easing effects like ease-in, ease-out, or a combination of both.

To use cubic Bezier easing, provide an array with four numbers `[x1, y1, x2, y2]` representing the control points. For example, `[0.6, 0, 0.4, 1]` creates a smooth ease-in-out effect.

**Example:**
```javascript
// Animate an element with a custom cubic Bezier easing function
Kinex.to(document.querySelector('#box'), 1000, { left: "200px" }, {
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
    await kinex.to(box, 1000, { left: '200px' });
    console.log('First animation done!');

    // Start another animation after the first one is complete
    await kinex.to(box, 500, { opacity: 0.5 });
    console.log('Second animation done!');

}

myAnimation();
```

In this example, the first animation moves an element to the left over 1 second. After it finishes, a message is logged, and then a second animation starts to change the opacity. This shows how you can run animations one after another using `async/await` in a simple way.