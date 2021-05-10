export default function () {
  return site => {
    const input = '_site/img/*.{jpg,avif,webp}';
    const outputDir = '_site/img/';

    const encoders = [
      'avif',
      'webp',
      'mozjpeg'
    ];

    for (let encoder of encoders) {
      site.addEventListener('afterBuild', `npx @squoosh/cli --${encoder} auto --output-dir ${outputDir} ${input}`);
    }
  };
}
