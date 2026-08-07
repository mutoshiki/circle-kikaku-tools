export default {
  rules: {
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': [true, { ignore: ['consecutive-duplicates-with-different-values'] }],
    'declaration-block-trailing-semicolon': null,
    'font-family-no-duplicate-names': true,
    'function-calc-no-unspaced-operator': true,
    'no-duplicate-at-import-rules': true,
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],
    'selector-pseudo-element-no-unknown': [true, { ignorePseudoElements: ['part'] }],
    'string-no-newline': true,
    'unit-no-unknown': true
  }
};
