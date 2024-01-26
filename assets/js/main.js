
var _scrollTimer = [];

function smoothScrollTo(y, time) {
  time = time == undefined ? 500 : time;

  var scrollPosY = Math.round(window.scrollY);
  var scrollPosX = Math.round(window.scrollX);
  var count = 60;
  var length = (y - scrollPosY);

  function easeInOut(k) {
    return .5 * (Math.sin((k - .5) * Math.PI) + 1);
  }

  for (var i = _scrollTimer.length - 1; i >= 0; i--) {
    clearTimeout(_scrollTimer[i]);
  }

  for (var i = 0; i <= count; i++) {
    (function() {
      var cur = i;
      _scrollTimer[cur] = setTimeout(function() {
        window.scrollTo(scrollPosX, scrollPosY + length * easeInOut(cur/count));
      }, (time / count) * cur);
    })();
  }
}

