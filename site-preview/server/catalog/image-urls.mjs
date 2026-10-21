import versions from '../../src/data/image-versions.json' with { type: 'json' };
export const imageUrl = url => versions[url] ?? url;
export const imageSrcset = value => value.replace(/\/images\/[^\s,]+/g, imageUrl);
