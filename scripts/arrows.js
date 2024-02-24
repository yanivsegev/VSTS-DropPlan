
function drawArrowhead(ctx, can, locx, locy, angle, sizex, sizey, fillStyle) {
    var hx = sizex / 2;
    var hy = sizey / 2;

    ctx.translate((locx ), (locy));
    ctx.rotate(angle);
    ctx.translate(-hx,-hy);

    ctx.beginPath();
    ctx.fillStyle = fillStyle;

    ctx.moveTo(0,0);
    ctx.lineTo(0,1*sizey);    
    ctx.lineTo(1*sizex,1*hy);
    ctx.closePath();
    ctx.fill();

    ctx.translate(hx,hy);
    ctx.rotate(-angle);
    ctx.translate(-locx,-locy);
}


// returns radians
function findAngle(sx, sy, ex, ey) {
    // make sx and sy at the zero point
    return Math.atan((ey - sy) / (ex - sx))-(sx > ex ? Math.PI : 0);
}

function drawArrowByXY(ctx, can, sx,sy,c1x,c1y,c2x,c2y, ex,ey, fillStyle, includeArrow)
{
    ctx.beginPath();
    ctx.strokeStyle = fillStyle;
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(c1x,c1y,c2x,c2y, ex, ey);
    ctx.stroke();
    if (includeArrow == true){
        var ang = findAngle(c2x,c2y, ex, ey);
        ctx.fillRect(ex, ey, 2, 2);
        drawArrowhead(ctx, can, ex, ey, ang, 20, 20, fillStyle);
    }
}

function drawArrow(ctx, can, elm1, elm2, fillStyle, includeArrow){
    var sx = elm1.offset().left;
    var sy = elm1.offset().top;
    if (!elm2.offset()){
        console.error("drawArrow failed.");
        return;
    }
    var ex = elm2.offset().left;
    var ey = elm2.offset().top;
    var c1x,c1y,c2x,c2y;
    var distance = 30;

    if (sx < ex) {
        
        sx = sx + elm1.outerWidth();
        sy = sy + elm1.outerHeight()/2;
        ey = ey + elm2.outerHeight()/2;
        
        distance = (ex - sx)/2

        if (distance < 100 ){
            distance = 100;
        }

        c1x = sx + distance;
        c1y = sy;
        
        c2x = ex - distance;
        c2y = ey;
    }
    else if (sx > ex) {
        
        ex = ex + elm2.outerWidth();
        
        sy = sy + elm1.outerHeight()/2;
        ey = ey + elm2.outerHeight()/2;
        
        distance = (sx - ex)/2

        if (distance < 100 ){
            distance = 100;
        }

        c1x = sx - distance;
        c1y = sy;
        
        c2x = ex + distance;
        c2y = ey;
    }
    else if (sy < ey) {
        sy = sy + elm1.outerHeight();
        sx = sx + elm1.outerWidth()/2;
        ex = ex + elm2.outerWidth()/2;

        distance = (ey - sy)/2

        if (distance < 100 ){
            distance = 100;
        }

        c1x = sx;
        c1y = sy + distance;
        
        c2x = ex;
        c2y = ey - distance;
    }
    else if (sy > ey) {
        ey = ey + elm2.outerHeight();
        
        sx = sx + elm1.outerWidth()/2;
        ex = ex + elm2.outerWidth()/2;
        
        distance = (sy - ey)/2

        if (distance < 100 ){
            distance = 100;
        }

        c1x = sx;
        c1y = sy - distance;
        
        c2x = ex;
        c2y = ey + distance;
    }
    

    drawArrowByXY(ctx, can, sx, sy ,c1x,c1y,c2x,c2y, ex ,ey, fillStyle, includeArrow);
}

function clearRelations(){

    var can = document.getElementById('canvas1');
    var ctx = can.getContext('2d');
    clearRelationsInternal(ctx, can);

    var can1 = document.getElementById('canvas2');
    var ctx1 = can.getContext('2d');
    clearRelationsInternal(ctx1, can1);
}

function clearRelationsInternal(ctx, can){
    can.width = $("table").width();
    can.height = $("table").height();

     ctx.clearRect(0,0,can.width,can.height);
}
    
function drawRelations() {
    var can = document.getElementById('canvas1');
    var ctx = can.getContext('2d');
    
    clearRelations(ctx, can);
    var pathslist = [];
    sprint.Wits.forEach(function(item1,index1) {
        if (item1.isTaskWit && item1.Relations){

            item1.Relations.forEach(function(item,index) { 
                if (item.rel == "System.LinkTypes.Dependency-Forward"){
                    
                    var seccesor = item.url.substring(item.url.lastIndexOf("/") + 1)
                    var seccesorDiv = $("div[witId=" + seccesor + "]");
                    var item2 = sprint.GetWorkitemById(seccesor)
                    if (item2)
                    {
                        var fillStyle = "gray";
                        var start1 = item1.StartDate;
                        var end2 = item2.FinishDate;
                        if ( start1 > end2 ) 
                        {
                            fillStyle = "red";
                        }
                        var currentDiv = $("div[witId=" + item1.Id + "]");

                        if (seccesorDiv.length > 0 && currentDiv.length > 0){
                            drawArrow(ctx, can, currentDiv, seccesorDiv,fillStyle, true);
                        }
                    }
                }
            });
        }
    });

}