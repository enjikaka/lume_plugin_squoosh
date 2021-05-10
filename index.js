export default function () {
  return site => {
    site.addEventListener('afterBuild', 'npx @squoosh/cli --mozjpeg auto _site/img/*.jpg');
  };
}
