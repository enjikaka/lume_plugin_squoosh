# lume_plugin_squoosh

A plugin for Lume to use Squoosh CLI for handling images for your static site.

Requires that you have Node installed for running Squoosh CLI via npx.

## Usage

In your Lume `_config.js` file import and add this plugin like so:

```js
import squoosh from "https://deno.land/x/lume_plugin_squoosh@v0.0.8/index.js";

const site = lume();

site.use(squoosh());
```

The squoosh method takes an optional parameter than is an array of formats to generate. If not set, it default to generating WEBP and AVIF.

Example of editing output formats:

```js
import squoosh from "https://deno.land/x/lume_plugin_squoosh@v0.0.8/index.js";

const site = lume();

site.use(squoosh(['jxl', 'wp2']));
```

Put your images like normal in the img directory and reference them in your post with an HTML-image tag and specify desired sizes with the `width` and `data-srcset` attribute.

```html
<img src="/img/2022-01-13-forodling-hyllis.jpg" width="600" data-srcset="1x, 1.5x, 2x" alt="Förodlingsstation med IKEA Hyllis">
```

Make sure that `width` is the same as the actual final element with on your page, for loading performance reasons. `width="600"` and `data-srcset="1x, 1.5x, 2x"` above instructs the plugin to render sizes at 600px, 900px and 1200px.

The plugin will transform the <img> tag into a <picture> tag with the desired formats from _config.js (or the default ones if not set) and with all the sizes:

```html
<picture title="Förodlingsstation med IKEA Hyllis">
  <source srcset="/img/2022-01-13-forodling-hyllis_600w.webp 600w, /img/2022-01-13-forodling-hyllis_900w.webp 900w, /img/2022-01-13-forodling-hyllis_1200w.webp 1200w" type="image/webp">
  <source srcset="/img/2022-01-13-forodling-hyllis_600w.avif 600w, /img/2022-01-13-forodling-hyllis_900w.avif 900w, /img/2022-01-13-forodling-hyllis_1200w.avif 1200w" type="image/avif">
  <img src="/img/2022-01-13-forodling-hyllis_600w.webp" alt="Förodlingsstation med IKEA Hyllis" width="600" sizes="600w" loading="lazy" decoding="async">
</picture>
```

If you want a real world use-case example this plugin is used for my farm blog.
Live site: https://barlingshult.se
Source: https://github.com/enjikaka/barlingshult
