 Date.prototype.addDays = function(days) {
  
    return new Date(this.valueOf() + days * 24 * 60 * 60000);
}

Date.prototype.yyyymmdd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [this.getFullYear(),
          (mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd
         ].join('');
};

Date.prototype.yyyy_mm_dd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [this.getFullYear(),
          (mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd
         ].join('/');
};

Date.prototype.mmdd = function() {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [(mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd
         ].join('/');
};

//"2018-01-25T00:00:00Z"
Date.prototype.tfsFormat = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();
  
    return [this.getFullYear(),
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd
           ].join('-') + "T00:00:00Z";
  };


Date.prototype.getGMT = function() {
    return new Date(this.valueOf() + this.getTimezoneOffset() * 60000);
};

Date.prototype.ConvertGMTToServerTimeZone = function() {

    if (!this._serverToGMTDiff){
        this._serverToGMTDiff = (new Date(VSS.Core.convertValueToDisplayString(new Date("2000-01-01"), 'u')).getTime() - new Date("2000-01-01").getTime()) + (new Date().getTimezoneOffset() * 60000);
    }


    return new Date(this.getTime() - this._serverToGMTDiff);
};



function getDates(startDate, stopDate) {
    var dateArray = new Array();
    var currentDate = startDate;
    while (currentDate <= stopDate) {
        dateArray.push( new Date (currentDate) )
        currentDate = currentDate.addDays(1);
    }
    return dateArray;
}

function isDayInRange(range, date){
    var inRange = false;
    $.each(range, function( index2, value2 ) {
        $.each( getDates(value2.start, value2.end), function( index2, value3 ) {
            if (value3.getGMT().yyyymmdd() == date) inRange = true;
        });
    });
    return inRange;
}