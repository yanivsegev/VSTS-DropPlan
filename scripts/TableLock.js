/*****************************************************************
 Copyright 2016, Kjell.Ericson@haxx.se, version 2016-01-05

The script uses classes for defining what parts to use for scrolling.

Source at: https://github.com/kjellericson/TableLock.git

You shall mark the things:

1) One id for the table.
2) One class name for to row cells to lock
3) One class name for the column cells to lock
4) The upper left cell that moves both ways (I call it "locked").

Set a field to null in order to skip that part.

You init the function by calling:

  TableLock("table_class_name", "row_class_name", "column_class_name", "locked_class_name");

The table is made up like this:

 <table id='table_class_name'>
  <tr>
    <td class='locked_class_name'>Upper left is moving both wayslocked</td>
    <td class='column_class_name'>column 1</td>
    <td class='column_class_name'>column 2</td>
    <td class='column_class_name'>column 3</td>
  </tr>
  <tr>
    <td class='row_class_name'>row 1</td>
    <td>data 1</td>
    <td>data 2</td>
    <td>data 3</td>
  </tr>
  <tr>
    <td class='row_class_name'>row 2</td>
    <td>data 1</td>
    <td>data 2</td>
    <td>data 3</td>
  </tr>
</table>

******************************/

(function () {
    TL_tables = new Array();

    function TL_settings(table_id, left_class_name, headline_class_name,
                         lock_class_name) {
        this.row_elements = new Array();
        this.col_elements = new Array();
        this.lock_elements = new Array();
        this.table_id = table_id;
        this.left_class_name = left_class_name;
        this.headline_class_name = headline_class_name;
        this.lock_class_name = lock_class_name;
    }

    function TL_struct(node, oldnode, xpos, ypos) {
        this.node = node;
        this.oldnode = oldnode;
        this.x = xpos;
        this.y = ypos;
    }

    function TableLock(table_id,
                       left_class_name,
                       headline_class_name,
                       lock_class_name) {
        var tlt = new TL_settings(table_id, left_class_name, headline_class_name,
                       lock_class_name);
        TableLock_resize(tlt);
        TL_tables.push(tlt);
        this.onscroll = TableLock_update;
        TableLock_update();

        // Detect resize every second
        window.setInterval(function () {
            var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
            if (tlt.innerwidth != width &&
               tlt.innerheight != height) {
                TableLock_resize(tlt);
                TableLock_update();
            }
        }, 1000);
    }

    function TableLock_resize(tlt) {
        tlt.table_element = document.getElementById(tlt.table_id);
        if (tlt.table_element == undefined) {
            alert("TableLock can't find table " + tlt.table_id);
            return;
        }

        // Remove any old objects
        for (var i = 0; i < tlt.row_elements.length; i++) {
            var obj = tlt.row_elements[i];
            document.body.removeChild(obj.node);
        }
        for (var i = 0; i < tlt.col_elements.length; i++) {
            var obj = tlt.col_elements[i];
            document.body.removeChild(obj.node);
        }
        for (var i = 0; i < tlt.lock_elements.length; i++) {
            var obj = tlt.lock_elements[i];
            document.body.removeChild(obj.node);
        }

        // Reset settings
        tlt.innerwidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        tlt.innerheight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

        tlt.last_x = -1;
        tlt.row_elements = new Array();
        tlt.col_elements = new Array();
        tlt.lock_elements = new Array();

        tlt.min_x = 10000;
        tlt.min_y = 10000;

        tlt.max_x = 0;
        tlt.max_y = 0;

        var tags = new Array("td", "th");
        var max = 2000;
        for (var t = 0; t < tags.length; t++) {
            var tag = tags[t];
            var elements = tlt.table_element.getElementsByTagName(tag);
            for (var i = 0; i < elements.length; i++) {
                var node = elements.item(i);
                var pos = TL_getPos(node);
                // Store bounderies for table.
                if (pos.x < tlt.min_x)
                    tlt.min_x = pos.x;
                if (pos.y < tlt.min_y)
                    tlt.min_y = pos.y;

                if (pos.x > tlt.max_x)
                    tlt.max_x = pos.x;
           //     if (pos.y > tlt.max_y)
             //       tlt.max_y = pos.y;

                for (var j = 0; j < node.attributes.length; j++) {
                    var n = node.attributes.item(j);

                    if (n.nodeName == 'class') {

                        if ((tlt.left_class_name && n.nodeValue.indexOf(tlt.left_class_name) >= 0) ||
                            (tlt.lock_class_name && n.nodeValue.indexOf(tlt.lock_class_name) >= 0) ||
                            (tlt.headline_class_name && n.nodeValue.indexOf(tlt.headline_class_name) >= 0)) {

                            var newNode = document.createElement("div");
                            for (var p in node.style) {
                                try {
                                    newNode.style[p] = node.style[p]
                                }
                                catch (e) {
                                }
                            }
                            newNode.innerHTML = node.innerHTML;
                            newNode.style.height = node.offsetHeight + "px";
                            newNode.style.width = node.offsetWidth + "px";
                            newNode.style.position = "absolute";
                            newNode.style.zIndex = "1000";
                            // newNode.class = node.class;
                            newNode.style.left = pos.x + "px";
                            newNode.style.top = pos.y + "px";

                            if (max-- == 0) return;
                            if (tlt.headline_class_name &&
                                node.attributes.item(j).nodeValue.indexOf(tlt.headline_class_name) >= 0)
                                tlt.col_elements.push(new TL_struct(newNode, node, pos.x, pos.y));
                            else if (tlt.lock_class_name &&
                                     node.attributes.item(j).nodeValue.indexOf(tlt.lock_class_name) >= 0)
                                tlt.lock_elements.push(new TL_struct(newNode, node, pos.x, pos.y));
                            else
                                tlt.row_elements.push(new TL_struct(newNode, node, pos.x, pos.y));
                        }
                    }
                }
            }
        }

        for (var i = 0; i < tlt.row_elements.length; i++) {
            var obj = tlt.row_elements[i];
            //obj.oldnode.parentNode.insertBefore(obj.node, obj.oldnode);
            document.body.appendChild(obj.node);
        }
        for (var i = 0; i < tlt.col_elements.length; i++) {
            var obj = tlt.col_elements[i];
            document.body.appendChild(obj.node);
        }
        for (var i = 0; i < tlt.lock_elements.length; i++) {
            var obj = tlt.lock_elements[i];
            document.body.appendChild(obj.node);
        }
    }

    function TableLock_update() {
        var iebody = (document.compatMode && document.compatMode != "BackCompat") ? document.documentElement : document.body;

        var scroll_left = document.all ? iebody.scrollLeft : pageXOffset;
        var scroll_top = document.all ? iebody.scrollTop : pageYOffset;

        for (var t = 0; t < TL_tables.length; t++) {
            var tlt = TL_tables[t];
            for (var i = 0; i < tlt.row_elements.length; i++) {
                var obj = tlt.row_elements[i];
                var x = obj.x;
                if (scroll_left > tlt.min_x)
                    x = scroll_left - tlt.min_x + x;
                if (x > tlt.max_x)
                    x = tlt.max_x;
                obj.node.style.left = x + "px";
            }
            for (var i = 0; i < tlt.col_elements.length; i++) {
                var obj = tlt.col_elements[i];
                var y = obj.y;
                if (scroll_top > tlt.min_y)
                    y = scroll_top - tlt.min_y + y;
               // if (y > tlt.max_y)
               //     y = tlt.max_y;
                obj.node.style.top = y + "px";
            }
            for (var i = 0; i < tlt.lock_elements.length; i++) {
                var obj = tlt.lock_elements[i];
                var x = obj.x;
                if (scroll_left > tlt.min_x)
                    x = scroll_left - tlt.min_x + x;
                if (x > tlt.max_x)
                    x = tlt.max_x;
                obj.node.style.left = x + "px";
                var y = obj.y;
                if (scroll_top > tlt.min_y)
                    y = scroll_top - tlt.min_y + y;
            //    if (y > tlt.max_y)
              //      y = tlt.max_y;
                obj.node.style.top = y + "px";
            }
        }
    }

    function TL_getPos(oElement) {
        var y = 0;
        var x = 0;
        while (oElement != null) {
            y += oElement.offsetTop;
            x += oElement.offsetLeft;
            oElement = oElement.offsetParent;
        }
        return { x: x, y: y };
    }

    // Add the TableLock function to the window to make it global
    window.TableLock = TableLock;
}());
