import * as pdfjsLib from '/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new CustomEvent('pdfjsReady'));
