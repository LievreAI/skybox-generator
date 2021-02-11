const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const outputCanvas = document.createElement('canvas');
const outputCtx = outputCanvas.getContext('2d');

class CubeFace {
  constructor(faceName) {
    this.faceName = faceName;

    this.anchor = document.createElement('a');
    this.anchor.style.position='absolute';
    this.anchor.title = faceName;

    this.img = document.createElement('img');

    this.anchor.appendChild(this.img);
  }

  setPreview(url, x, y) {
    this.img.src = url;
    this.img.style.width = '200px';
    this.img.style.height = '200px';
    this.anchor.style.left = `${x}px`;
    this.anchor.style.top = `${y}px`;
    this.anchor.style.width = '200px';
    this.anchor.style.height = '200px';
  }

  setDownload(url, fileExtension) {
    this.anchor.href = url;
    this.anchor.download = `${this.faceName}.${fileExtension}`;
  }
}

function removeChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

const mimeType = {
  'jpg': 'image/jpeg',
  'png': 'image/png'
};

function getDataURL(imgData, extension) {
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  ctx.putImageData(imgData, 0, 0);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), mimeType[extension], 0.92);
  });
}

const dom = {
  imageInput: document.getElementById('imageInput'),
  faces: document.getElementById('faces'),
  generating: document.getElementById('generating'),
  download: document.getElementById('download')
};

dom.imageInput.addEventListener('change', loadImage);

const facePositions = {
  back: {x: 2, y: 0},
  front: {x: 1, y: 1},
  left: {x: 0, y: 1},
  right: {x: 2, y: 1},
  top: {x: 1, y: 0},
  bottom: {x: 0, y: 0}
};

function loadImage() {
  const file = dom.imageInput.files[0];

  if (!file) {
    return;
  }

  const img = new Image();

  img.src = URL.createObjectURL(file);

  img.addEventListener('load', () => {
    const {width, height} = img;
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, width, height);

    outputCanvas.width = data.width / 4 * 3;
    outputCanvas.height = data.width / 4 * 2;

    processImage(data);
  });
}

let finished = 0;
let workers = [];

function processImage(data) {
  removeChildren(dom.faces);
  dom.generating.style.visibility = 'visible';
  dom.download.style.visibility = 'hidden';

  for (let worker of workers) {
    worker.terminate();
  }

  for (let [faceName, position] of Object.entries(facePositions)) {
    renderFace(data, faceName, position);
  }
}

function renderFace(data, faceName, position) {
  const face = new CubeFace(faceName);
  dom.faces.appendChild(face.anchor);

  const options = {
    data: data,
    face: faceName
  };

  const worker = new Worker('convert.js');

  const setDownload = ({data: imageData}) => {
    const extension = 'png';

    const x = 200 * position.x;
    const y = 200 * position.y;

    getDataURL(imageData[0], extension).then(url => {
      face.setDownload(url, extension);
      face.setPreview(url, x, y);
    });

    // put the image data back into a canvas to stitch together
    outputCtx.putImageData(imageData[0], position.x * imageData[0].width, position.y * imageData[0].height);

    finished++;

    if (finished === 6) {
      dom.generating.style.visibility = 'hidden';

      new Promise(resolve => {
        outputCanvas.toBlob(blob => resolve(URL.createObjectURL(blob)), mimeType['png'], 0.92);
      }).then(url => {
        dom.download.style.visibility = 'visible';
        dom.download.href = url;
        dom.download.download = 'skybox.png';
      });

      workers = [];
      finished = 0;
    }
  };

  worker.onmessage = () => {
    worker.onmessage = setDownload;
    worker.postMessage(options);
  };

  worker.postMessage(Object.assign({}, options));

  workers.push(worker);
}
