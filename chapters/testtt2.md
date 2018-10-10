<style>
#canvas{
  border: solid 1px blue;  
  width: 100%;
}
  
  .outer {
 position: relative;
 width: 100%;
 padding-bottom: 100%;
}

#canvas {
 position: absolute;
 width: 100%;
 height: 100%;
}

</style>

<div class="outer">
 <canvas id="myCanvas"  height="1800" style="display: block;">
Your browser does not support the HTML5 canvas tag.</canvas>
</div>


<script>
var c = document.getElementById("myCanvas");
var ctx = c.getContext("2d");
ctx.moveTo(200,0);
ctx.lineTo(200,1800);
ctx.stroke();
var ctx2 = c.getContext("2d");
ctx2.beginPath();
ctx2.arc(200, 55, 10, 0, 2 * Math.PI);
ctx2.fillStyle = "#ff0000";
ctx2.fill();
var ctx3 = c.getContext("2d");
ctx3.beginPath();
ctx3.arc(200,155,10,0,2 * Math.PI);
ctx3.fillStyle = "#ff0000";
ctx3.fill();
var ctx4 = c.getContext("2d");
ctx4.font = "30px Arial";
ctx4.fillText("Hello World",250,120);
</script>

