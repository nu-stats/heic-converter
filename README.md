# HEIC Converter

A one-page web app that turns iPhone photos (`.heic` / `.heif`) into JPG, PNG or WebP. It runs entirely in your browser: photos are decoded and re-encoded on your own computer and are never uploaded anywhere.

**Use it online:** https://nu-stats.github.io/heic-converter/

## How to use

1. Open the page.
2. Drop photos on the box, or click it to choose them. You can add many at once.
3. Pick **JPG**, **PNG** or **WebP**. For JPG and WebP, set the quality (92 is a good default).
4. Click **Save** next to a photo, or **Download all (.zip)** for everything.

Changing the format or quality re-converts every photo in the list. JPG, PNG, WebP and AVIF files can be dropped too, so the page also works as a general image format converter.

Notes:

- Converted copies do not keep the original's EXIF data (GPS location, camera, date taken).
- Safari cannot write WebP, so that option is hidden there.
- Very large batches use a lot of memory; convert a few hundred photos at a time at most.

## Running it yourself

There is no build step. Serve the folder with any static web server, for example:

```bash
python -m http.server 8000
```

then open http://localhost:8000. In Pinokio, the folder opens as a web app directly (`index.html` + `pinokio.json`).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page and its styles |
| `app.js` | Reading, converting and downloading the photos |
| `vendor/heic-to.js` | [heic-to](https://github.com/hoppergee/heic-to) 1.6.5 (libheif 1.23.5), LGPL-3.0 |
| `vendor/jszip.min.js` | [JSZip](https://stuk.github.io/jszip/) 3.10.1, MIT |

## Programmatic use

The page has no server or API, but the same library can be used in your own code.

JavaScript (browser):

```html
<script src="https://nu-stats.github.io/heic-converter/vendor/heic-to.js"></script>
<script>
  async function toJpeg(file) {
    if (!(await HeicTo.isHeic(file))) return file;
    return HeicTo({ blob: file, type: "image/jpeg", quality: 0.92 }); // returns a Blob
  }
</script>
```

Python (outside the browser), with [pillow-heif](https://pypi.org/project/pillow-heif/):

```python
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()
Image.open("IMG_0001.heic").convert("RGB").save("IMG_0001.jpg", quality=92)
```

curl (download the library for offline use):

```bash
curl -O https://nu-stats.github.io/heic-converter/vendor/heic-to.js
```
