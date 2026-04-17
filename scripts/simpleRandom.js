const SimpleRandom = {
    a: 1103515245,
    c: 12345,
    m: Math.pow(2, 31),

    next (value)
    {
        value = (value * 1103515245 + 12345) % 2147483648;
        return value / 2147483648; // Returns 0 to 1
    },

    hillHeight(x, y) {
        return Math.sin((x + y) * 0.1);
    }
}

export {SimpleRandom};