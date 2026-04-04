---
layout: default
title: Projects
---

<style>

:root{
            --bg-color: #000;
            --text-color: #fff;
            --accent-color: #555;
            --status-color: #00ff41; /* Terminal green */
            --bg-image: url("/assets/wallpapers/back2-dark.png");
}
/* Container */
.project-table {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 2rem 0;
}

/* Each row */
.project-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid #ddd;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-row:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

/* Left side (text) */
.project-info {
  flex: 1 1 300px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.project-info h3 {
  margin: 0 0 0.2rem 0;
  font-size: 1.25rem;
  color: #222;
}

.project-info p {
  margin: 0.25rem 0;
  line-height: 1.5;
  color: #bbb;
}

.project-title a {
    font-size: 1.3rem;
    font-weight: 1000;
    text-decoration: none;
    color: var(--text-color);
    text-transform: uppercase;
    transition: opacity 0.8s ease;
}

.programming-name {
    font-size: 1.15rem;
}

/* Right side (image) */
.project-image {
  flex: 0 0 250px;
  max-width: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.project-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.project-row:hover .project-image img {
  transform: scale(1.05);
}

/* Responsive (stack on small screens) */
@media (max-width: 700px) {
  .project-row {
    flex-direction: column;
  }

  .project-image {
    max-width: 100%;
    width: 100%;
    height: 200px;
  }
}
</style>

<div class="project-table">

  <div class="project-row">
    <div class="project-info">
      <h3 class="project-title"><a href="/projects/pdf.html">PDF Search</a></h3>
      <p class="programming-name"><strong><b> Javascript, PDFjs, JSZip<b></strong></p>
      <p>Scans a zip or folder of PDFs for a large list of keywords and jump between matches.  </p>
      <p>I vibe coded this to be a more versatile version of the python tool below</p>
      <p class="programming-name"><strong>Last Updated:</strong> 2026</p>
    </div>
    <div class="project-image">
      <a href="/projects/pdf.html"><img class="project-image" src="/projects/pdf.png" alt="PDF Highlighter"></a>
    </div>
  </div>
  
  <div class="project-row">
    <div class="project-info">
      <h3 class="project-title"><a href="/projects/pdf_scan5.py">PDF Keyword Highlighter</a></h3>
      <p class="programming-name"><strong><b> Python, PyMuPDF<b></strong></p>
      <p>Scans a folder of PDFs for a large list of keywords and outputs a new version with highlights and removes pages without matches</p>
        <p>I wrote and use this for work but has been more or less replaced by the javascript tool above</p>
      <p class="programming-name"><strong>Last Updated:</strong> 2025</p>
    </div>
    <div class="project-image">
      <img class="project-image" src="/projects/pdf_scan.png" alt="PDF Highlighter">
    </div>
  </div>
  

  <div class="project-row">
    <div class="project-info">
      <h3 class="project-title"><a href="https://github.com/niveknosredneh/PFSG">FileSystem Grapher</a></h3>
      <p class="programming-name"><strong><b> Python, Graphviz<b></strong></p>
      <p>Creates beautiful graphs of directories on your filesystem</p>
      <p class="programming-name"><strong>Last Updated:</strong> 2019</p>
    </div>
    <div class="project-image">
      <a href="https://github.com/niveknosredneh/PFSG"><img class="project-image" src="/projects/sfdp.png" alt="Graphs"></a>
    </div>
  </div>

   <div class="project-row">
    <div class="project-info">
      <h3 class="project-title"><a href="https://github.com/niveknosredneh/MagickStack">MagickStack</a></h3>
      <p class="programming-name"><strong><b> Python, Shell, ImageMagick<b></strong></p>
      <p>  merge/stack multiple images horizontally or vertically to create a single image out of many. Annotates image with timestamp and renames image with current date for a simpler upload to server.</p>
      <p class="programming-name"><strong>Last Updated:</strong> 2024</p>
    </div>
      <a href="https://github.com/niveknosredneh/MagickStack"><img class="project-image" src="/projects/stack.png" alt="Graphs"></a>
    </div>
  </div>
  
</div>


