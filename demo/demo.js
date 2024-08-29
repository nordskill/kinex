import kinex from '../src/kinex.js';

const box1 = document.querySelector('.box1');
const box2 = document.querySelector('.box2');

const obj = {
    name: 'something',
    some_property: 1
}

kinex.to(obj, 150, { some_property: 100 }, {
    easing: [0.5, 0, 0, 0.5],
    on_start: () => console.log('object\'s "some_property" interpolation starts'),
    on_update: (values) => console.log(values),
    on_complete: () => console.log('some_property\'s interpolation ends')
});

box1.style.position = 'absolute';
box1.style.opacity = 1;
box2.style.position = 'absolute';
box2.style.opacity = 1;
// box.style.width = '0px';
const coords1 = { x: 0, y: 0, opacity: 1 };
const coords2 = { x: 0, y: 0, opacity: 1 };

setTimeout(async () => {

    kinex.to(box1.style, 1000, { opacity: 0.5, left: '120px' }, {
        easing: [0.25, 0, 0, 1],
        on_start: () => {
            console.log('box 1 starts moving');
        },
        on_complete: () => {
            console.log('box 1 stops moving');
        }
    });

    await kinex.to(box2.style, 1000, { opacity: 0.5, top: '80px' }, {
        easing: [0.25, 0, 0, 1],
        delay: 500
    });

    // kinex.to(coords1, 1000, { x: 200, opacity: 0.5 }, {
    //     easing: [0.25, 0, 0, 1],
    //     on_start: (values) => {
    //         console.log(values);
    //     },
    //     on_update: (values) => {
    //         box1.style.transform = `translate(${coords1.x}px, ${coords1.y}px)`;
    //         box1.style.opacity = coords1.opacity;
    //     },
    //     on_complete: (values) => {
    //         console.log(values);
    //     }
    // });
    // await kinex.to(coords2, 1000, { y: 100, opacity: 0.5 }, {
    //     easing: [0.25, 0, 0, 1],
    //     on_start: (values) => {
    //         console.log(values);
    //     },
    //     on_update: (values) => {
    //         box2.style.transform = `translate(${coords2.x}px, ${coords2.y}px)`;
    //         box2.style.opacity = coords2.opacity;
    //     },
    //     on_complete: (values) => {
    //         console.log(values);
    //     }
    // });

    console.log('all animations complete');

}, 1000);


