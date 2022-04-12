import { posix, dirname, extname, basename } from 'lume/deps/path.ts';
import { exists } from 'lume/deps/fs.ts';
import type { Site, Page } from 'lume/core.ts';
import { HTMLDocument, Element } from "lume/deps/dom.ts";

const squooshTasks: string[] = [];
let formats: string[];

const mimeTypes: Record<string, string> = {
  'avif': 'image/avif',
  'webp': 'image/webp',
  'jpg': 'image/jpeg',
  'wp2': 'image/webp2',
  'jxl': 'image/jxl'
};

async function generatePictureElement(site: Site, document: HTMLDocument, image: Element) {
  const imgSrc = image.getAttribute('src');
  const imgWidth = image.getAttribute('width');

  if (!imgSrc) {
    throw new ReferenceError('Image is missing src: ' + image.outerHTML);
  }

  // Remote image, ignore.
  if (imgSrc.includes('http://') || imgSrc.includes('https://')) {
    return;
  }

  if (!imgWidth) {
    throw new ReferenceError('Image is missing width: ' + image.outerHTML);
  }

  const url = posix.relative(site.options.location.pathname, imgSrc);
  const originalImageExtention = extname(url);
  const filename = basename(imgSrc).split(extname(imgSrc))[0];

  const width = parseInt(imgWidth, 10);
  const srcset = image.getAttribute('data-srcset');

  const sizes: number[] = srcset ?
    srcset
      .split(',')
      .map(s => s.trim())
      .map(s => {
        if (s.includes('w')) {
          return parseInt(s, 10);
        } else if (s.includes('x')) {
          return parseFloat(s) * width;
        } else {
          throw new TypeError('Invalid srcset on image: ' + image.outerHTML);
        }
      }) :
    [width, width * 1.5, width * 2];

  const tasks = await Promise.all(
    sizes.map(async size => {
      const isMacOS = Deno.env.get('_system_type') === 'Darwin';
      const formatsToRender = [];

      const searches = formats.map(format => `_cache/${dirname(url)}/${filename}_${size}w.${format}`).map(async path => {
        const found = await exists(path);

        return { path, found };
      });

      for await (const search of searches) {
        if (!search.found) {
          formatsToRender.push(extname(search.path));
        }
      }

      const formatOptions = formatsToRender.map(format => {
        const flag = format === 'jpg' ? 'mozjpeg' : format.split('.').pop();

        return `--${flag} auto`;
      }).join(' ');

      if (formatOptions.length === 0) {
        return undefined;
      }

      return isMacOS ?
        // macOS needs double wrapping around object.
        `npx @squoosh/cli --resize '"{width: ${size}}"' ${formatOptions} --output-dir _cache/${dirname(url)}/ -s '_${size}w' ${url}` :
        // Linux fails on double wrapping, do single.
        `npx @squoosh/cli --resize '{width: ${size}}' ${formatOptions} --output-dir _cache/${dirname(url)}/ -s '_${size}w' ${url}`;
    })
  );

  const definedTasks = tasks.filter(Boolean) as string[];

  squooshTasks.push(...definedTasks);

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

function findAndOptimizeImages(site: Site, { document }: Page) {
  if (document) {
    const imgTags = [...document.querySelectorAll('img')];

    return Promise.all(imgTags.map(async image => {
      const picture = await generatePictureElement(site, document, image as Element);

      if (image && image.parentNode) {
        image.parentNode.replaceChild(picture, image);
      }
    }));
  }

  return Promise.resolve();
}

/**
 *
 * @param {'avif'|'jpg'|'webp'|'wp2'|'jxl'} _formats
 * @returns
 */
export default function (_formats = [
  'avif',
  'webp'
]) {
  formats = _formats;

  return (site: Site) => {
    site.process(['.html'], page => findAndOptimizeImages(site, page));

    site.addEventListener('afterBuild', () => {
      // Spread so they run in series, parallel will freeze your computer. :)
      site.script('image-optimizer', ...squooshTasks, 'cp -r _cache/img _site/');
      site.run('image-optimizer');
    });
  };
}
