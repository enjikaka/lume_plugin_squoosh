import { posix, dirname } from 'lume/deps/path.ts';
import { DOMParser } from 'lume/deps/dom.ts';
import { exists } from 'lume/deps/fs.ts';

import { documentToString } from 'lume/core/utils.ts';

const squooshTasks = [];
let formats;

const mimeTypes = {
  'avif': 'image/avif',
  'webp': 'image/webp',
  'jpg': 'image/jpeg'
};

async function generatePictureElement(site, document, image) {
  const url = posix.relative(site.options.location.pathname, image.getAttribute('src'));
  const originalImageExtention = '.' + url.split('.').pop();

  const width = parseInt(image.getAttribute('width'), 10);
  const srcset = image.getAttribute('data-srcset');

  const sizes = srcset ?
    srcset
      .split(',')
      .map(s => s.trim())
      .map(s => {
        if (s.includes('w')) {
          return parseInt(s, 10);
        }
        if (s.includes('x')) {
          return parseFloat(s) * width;
        }

        return s;
      }) :
    [width, width * 1.5, width * 2];

  const tasks = await Promise.all(
    sizes.map(async size => {
      const isMacOS = Deno.env.get('_system_type') === 'Darwin';

      const cachePath = posix.relative(
        site.options.location.pathname,
        `/_cache/${url}`.replace(originalImageExtention, `_${size}w${originalImageExtention}`)
      );

      const cachePathExists = await exists(cachePath);

      if (cachePathExists) {
        return undefined;
      }

      return isMacOS ?
        // macOS needs double wrapping around object.
        `npx @squoosh/cli --resize '"{width: ${size}}"' --mozjpeg auto --avif auto --webp auto --output-dir _cache/${dirname(url)}/ -s '_${size}w' ${url}` :
        // Linux fails on double wrapping, do single.
        `npx @squoosh/cli --resize '{width: ${size}}' --mozjpeg auto --avif auto --webp auto --output-dir _cache/${dirname(url)}/ -s '_${size}w' ${url}`;
    })
  );

  squooshTasks.push(
    ...tasks.filter(Boolean)
  );

  const picture = document.createElement('picture');

  formats.forEach(format => {
    const newSrcset = sizes
      .map(size => `/${url.replace(originalImageExtention, `_${size}w.${format}`)} ${size}w`)
      .join(', ');

    const source = document.createElement('source');

    source.setAttribute('srcset', newSrcset);
    source.setAttribute('type', mimeTypes[format]);

    picture.appendChild(source);
  });

  const img = document.createElement('img');

  img.setAttribute('src', '/' + url.replace(originalImageExtention, `_${sizes[0]}w.${formats[0]}`));
  img.setAttribute('alt', image.getAttribute('alt'));
  img.setAttribute('width', image.getAttribute('width'));
  img.setAttribute('sizes', width + 'w');
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');

  picture.setAttribute('title', image.getAttribute('alt'));
  picture.appendChild(img);

  return picture;
}

async function findAndOptimizeImages(site, page) {
  const parser = new DOMParser();
  const document = parser.parseFromString(page.content, 'text/html');

  [...document.querySelectorAll('img')].forEach(async image => {
    const picture = await generatePictureElement(site, document, image);

    image.parentNode.replaceChild(picture, image);

    page.content = documentToString(document);
  });
}

export default function (_formats = [
  'webp',
  'avif'
]) {
  formats = _formats;

  return site => {
    site.process(['.html'], page => findAndOptimizeImages(site, page));

    site.addEventListener('afterBuild', () => {
      // Spread so they run in series, parallel will freeze your computer. :)
      site.script('image-optimizer', ...squooshTasks, 'cp -r _cache/img _site/');
      site.run('image-optimizer');
    });
  };
}
