module.exports = {
    "env": {
        "browser": true,
        "es2020": true
    },
    "parserOptions": {
        "sourceType": "module",
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            2
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ]
    },
    "globals": {
        "keyboard": false,
        "glMatrix": false,
        "mat2": false,
        "mat2d": false,
        "mat3": false,
        "mat4": false,
        "quat": false,
        "quat2": false,
        "vec2": false,
        "vec3": false,
        "vec4": false,
        "mouse": false,
        "keyboard": false
    }
};
