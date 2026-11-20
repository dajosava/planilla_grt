/** Config para: npx md-to-pdf docs/manual-operativo.md --config-file docs/manual-operativo.pdf.js */
module.exports={
 stylesheet:["./docs/manual-operativo.pdf.css"],
 pdf_options:{
  format:"A4",
  printBackground:true,
  margin:{top:"16mm",right:"14mm",bottom:"16mm",left:"14mm"},
 },
 basedir:process.cwd(),
};
