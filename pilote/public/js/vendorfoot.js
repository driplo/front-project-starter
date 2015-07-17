/*!
 * viewport-units-buggyfill v0.5.3
 * @web: https://github.com/rodneyrehm/viewport-units-buggyfill/
 * @author: Rodney Rehm - http://rodneyrehm.de/en/
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.viewportUnitsBuggyfill = factory();
  }
}(this, function () {
  'use strict';
  /*global document, window, navigator, location, XMLHttpRequest, XDomainRequest*/

  var initialized = false;
  var options;
  var userAgent = window.navigator.userAgent;
  var viewportUnitExpression = /([+-]?[0-9.]+)(vh|vw|vmin|vmax)/g;
  var forEach = [].forEach;
  var dimensions;
  var declarations;
  var styleNode;
  var isBuggyIE = false;
  var isOldIE = false;
  var isOperaMini = userAgent.indexOf('Opera Mini') > -1;

  var isMobileSafari = /(iPhone|iPod|iPad).+AppleWebKit/i.test(userAgent) && (function() {
    // Regexp for iOS-version tested against the following userAgent strings:
    // Example WebView UserAgents:
    // * iOS Chrome on iOS8: "Mozilla/5.0 (iPad; CPU OS 8_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) CriOS/39.0.2171.50 Mobile/12B410 Safari/600.1.4"
    // * iOS Facebook on iOS7: "Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D201 [FBAN/FBIOS;FBAV/12.1.0.24.20; FBBV/3214247; FBDV/iPhone6,1;FBMD/iPhone; FBSN/iPhone OS;FBSV/7.1.1; FBSS/2; FBCR/AT&T;FBID/phone;FBLC/en_US;FBOP/5]"
    // Example Safari UserAgents:
    // * Safari iOS8: "Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4"
    // * Safari iOS7: "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A4449d Safari/9537.53"
    var iOSversion = userAgent.match(/OS (\d)/);
    // viewport units work fine in mobile Safari and webView on iOS 8+
    return iOSversion && iOSversion.length>1 && parseInt(iOSversion[1]) < 8;
  })();

  var isBadStockAndroid = (function() {
    // Android stock browser test derived from
    // http://stackoverflow.com/questions/24926221/distinguish-android-chrome-from-stock-browser-stock-browsers-user-agent-contai
    var isAndroid = userAgent.indexOf(' Android ') > -1;
    if (!isAndroid) {
      return false;
    }

    var isStockAndroid = userAgent.indexOf('Version/') > -1;
    if (!isStockAndroid) {
      return false;
    }

    var versionNumber = parseFloat((userAgent.match('Android ([0-9.]+)') || [])[1]);
    // anything below 4.4 uses WebKit without *any* viewport support,
    // 4.4 has issues with viewport units within calc()
    return versionNumber <= 4.4;
  })();

  // Do not remove the following comment!
  // It is a conditional comment used to
  // identify old Internet Explorer versions

  /*@cc_on

  @if (9 <= @_jscript_version && @_jscript_version <= 10)
    isBuggyIE = true;
  @end
  
  @if (@_jscript_version < 9) {
    isOldIE = true;
  }
  @end
  
  @*/

  // added check for IE11, since it *still* doesn't understand vmax!!!
  if (!isBuggyIE) {
    isBuggyIE = !!navigator.userAgent.match(/Trident.*rv[ :]*11\./);
  }
  function debounce(func, wait) {
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      var callback = function() {
        func.apply(context, args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(callback, wait);
    };
  }

  // from http://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function initialize(initOptions) {
    if (initialized) {
      return;
    }

    if (initOptions === true) {
      initOptions = {
        force: true
      };
    }

    options = initOptions || {};
    options.isMobileSafari = isMobileSafari;
    options.isBadStockAndroid = isBadStockAndroid;

    if (isOldIE || (!options.force && !isMobileSafari && !isBuggyIE && !isBadStockAndroid && !isOperaMini && (!options.hacks || !options.hacks.required(options)))) {
      // this buggyfill only applies to mobile safari, IE9-10 and the Stock Android Browser.
      if (window.console && isOldIE) {
        console.info('viewport-units-buggyfill requires a proper CSSOM and basic viewport unit support, which are not available in IE8 and below');
      }

      return {
        init: function () {}
      };
    }

    options.hacks && options.hacks.initialize(options);

    initialized = true;
    styleNode = document.createElement('style');
    styleNode.id = 'patched-viewport';
    document.head.appendChild(styleNode);

    // Issue #6: Cross Origin Stylesheets are not accessible through CSSOM,
    // therefore download and inject them as <style> to circumvent SOP.
    importCrossOriginLinks(function() {
      var _refresh = debounce(refresh, options.refreshDebounceWait || 100);
      // doing a full refresh rather than updateStyles because an orientationchange
      // could activate different stylesheets
      window.addEventListener('orientationchange', _refresh, true);
      // orientationchange might have happened while in a different window
      window.addEventListener('pageshow', _refresh, true);

      if (options.force || isBuggyIE || inIframe()) {
        window.addEventListener('resize', _refresh, true);
        options._listeningToResize = true;
      }

      options.hacks && options.hacks.initializeEvents(options, refresh, _refresh);

      refresh();
    });
  }

  function updateStyles() {
    styleNode.textContent = getReplacedViewportUnits();
    // move to the end in case inline <style>s were added dynamically
    styleNode.parentNode.appendChild(styleNode);
  }

  function refresh() {
    if (!initialized) {
      return;
    }

    findProperties();

    // iOS Safari will report window.innerWidth and .innerHeight as 0 unless a timeout is used here.
    // TODO: figure out WHY innerWidth === 0
    setTimeout(function() {
      updateStyles();
    }, 1);
  }

  function findProperties() {
    declarations = [];
    forEach.call(document.styleSheets, function(sheet) {
      if (sheet.ownerNode.id === 'patched-viewport' || !sheet.cssRules || sheet.ownerNode.getAttribute('data-viewport-units-buggyfill') === 'ignore') {
        // skip entire sheet because no rules are present, it's supposed to be ignored or it's the target-element of the buggyfill
        return;
      }

      if (sheet.media && sheet.media.mediaText && window.matchMedia && !window.matchMedia(sheet.media.mediaText).matches) {
        // skip entire sheet because media attribute doesn't match
        return;
      }

      forEach.call(sheet.cssRules, findDeclarations);
    });

    return declarations;
  }

  function findDeclarations(rule) {
    if (rule.type === 7) {
      var value;

      // there may be a case where accessing cssText throws an error.
      // I could not reproduce this issue, but the worst that can happen
      // this way is an animation not running properly.
      // not awesome, but probably better than a script error
      // see https://github.com/rodneyrehm/viewport-units-buggyfill/issues/21
      try {
        value = rule.cssText;
      } catch(e) {
        return;
      }

      viewportUnitExpression.lastIndex = 0;
      if (viewportUnitExpression.test(value)) {
        // KeyframesRule does not have a CSS-PropertyName
        declarations.push([rule, null, value]);
        options.hacks && options.hacks.findDeclarations(declarations, rule, null, value);
      }

      return;
    }

    if (!rule.style) {
      if (!rule.cssRules) {
        return;
      }

      forEach.call(rule.cssRules, function(_rule) {
        findDeclarations(_rule);
      });

      return;
    }

    forEach.call(rule.style, function(name) {
      var value = rule.style.getPropertyValue(name);
      // preserve those !important rules
      if (rule.style.getPropertyPriority(name)) {
        value += ' !important';
      }

      viewportUnitExpression.lastIndex = 0;
      if (viewportUnitExpression.test(value)) {
        declarations.push([rule, name, value]);
        options.hacks && options.hacks.findDeclarations(declarations, rule, name, value);
      }
    });
  }

  function getReplacedViewportUnits() {
    dimensions = getViewport();

    var css = [];
    var buffer = [];
    var open;
    var close;

    declarations.forEach(function(item) {
      var _item = overwriteDeclaration.apply(null, item);
      var _open = _item.selector.length ? (_item.selector.join(' {\n') + ' {\n') : '';
      var _close = new Array(_item.selector.length + 1).join('\n}');

      if (!_open || _open !== open) {
        if (buffer.length) {
          css.push(open + buffer.join('\n') + close);
          buffer.length = 0;
        }

        if (_open) {
          open = _open;
          close = _close;
          buffer.push(_item.content);
        } else {
          css.push(_item.content);
          open = null;
          close = null;
        }

        return;
      }

      if (_open && !open) {
        open = _open;
        close = _close;
      }

      buffer.push(_item.content);
    });

    if (buffer.length) {
      css.push(open + buffer.join('\n') + close);
    }

    // Opera Mini messes up on the content hack (it replaces the DOM node's innerHTML with the value).
    // This fixes it. We test for Opera Mini only since it is the most expensive CSS selector
    // see https://developer.mozilla.org/en-US/docs/Web/CSS/Universal_selectors
    if (isOperaMini) {
      css.push('* { content: normal !important; }');
    }

    return css.join('\n\n');
  }

  function overwriteDeclaration(rule, name, value) {
    var _value;
    var _selectors = [];

    _value = value.replace(viewportUnitExpression, replaceValues);

    if (options.hacks) {
      _value = options.hacks.overwriteDeclaration(rule, name, _value);
    }

    if (name) {
      // skipping KeyframesRule
      _selectors.push(rule.selectorText);
      _value = name + ': ' + _value + ';';
    }

    var _rule = rule.parentRule;
    while (_rule) {
      _selectors.unshift('@media ' + _rule.media.mediaText);
      _rule = _rule.parentRule;
    }

    return {
      selector: _selectors,
      content: _value
    };
  }

  function replaceValues(match, number, unit) {
    var _base = dimensions[unit];
    var _number = parseFloat(number) / 100;
    return (_number * _base) + 'px';
  }

  function getViewport() {
    var vh = window.innerHeight;
    var vw = window.innerWidth;

    return {
      vh: vh,
      vw: vw,
      vmax: Math.max(vw, vh),
      vmin: Math.min(vw, vh)
    };
  }

  function importCrossOriginLinks(next) {
    var _waiting = 0;
    var decrease = function() {
      _waiting--;
      if (!_waiting) {
        next();
      }
    };

    forEach.call(document.styleSheets, function(sheet) {
      if (!sheet.href || origin(sheet.href) === origin(location.href) || sheet.ownerNode.getAttribute('data-viewport-units-buggyfill') === 'ignore') {
        // skip <style> and <link> from same origin or explicitly declared to ignore
        return;
      }

      _waiting++;
      convertLinkToStyle(sheet.ownerNode, decrease);
    });

    if (!_waiting) {
      next();
    }
  }

  function origin(url) {
    return url.slice(0, url.indexOf('/', url.indexOf('://') + 3));
  }

  function convertLinkToStyle(link, next) {
    getCors(link.href, function() {
      var style = document.createElement('style');
      style.media = link.media;
      style.setAttribute('data-href', link.href);
      style.textContent = this.responseText;
      link.parentNode.replaceChild(style, link);
      next();
    }, next);
  }

  function getCors(url, success, error) {
    var xhr = new XMLHttpRequest();
    if ('withCredentials' in xhr) {
      // XHR for Chrome/Firefox/Opera/Safari.
      xhr.open('GET', url, true);
    } else if (typeof XDomainRequest !== 'undefined') {
      // XDomainRequest for IE.
      xhr = new XDomainRequest();
      xhr.open('GET', url);
    } else {
      throw new Error('cross-domain XHR not supported');
    }

    xhr.onload = success;
    xhr.onerror = error;
    xhr.send();
    return xhr;
  }

  return {
    version: '0.5.3',
    findProperties: findProperties,
    getCss: getReplacedViewportUnits,
    init: initialize,
    refresh: refresh
  };

}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJ2aWV3cG9ydC11bml0cy1idWdneWZpbGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiB2aWV3cG9ydC11bml0cy1idWdneWZpbGwgdjAuNS4zXG4gKiBAd2ViOiBodHRwczovL2dpdGh1Yi5jb20vcm9kbmV5cmVobS92aWV3cG9ydC11bml0cy1idWdneWZpbGwvXG4gKiBAYXV0aG9yOiBSb2RuZXkgUmVobSAtIGh0dHA6Ly9yb2RuZXlyZWhtLmRlL2VuL1xuICovXG5cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCc7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKFtdLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlLiBEb2VzIG5vdCB3b3JrIHdpdGggc3RyaWN0IENvbW1vbkpTLCBidXRcbiAgICAvLyBvbmx5IENvbW1vbkpTLWxpa2UgZW52aXJvbWVudHMgdGhhdCBzdXBwb3J0IG1vZHVsZS5leHBvcnRzLFxuICAgIC8vIGxpa2UgTm9kZS5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHMgKHJvb3QgaXMgd2luZG93KVxuICAgIHJvb3Qudmlld3BvcnRVbml0c0J1Z2d5ZmlsbCA9IGZhY3RvcnkoKTtcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgLypnbG9iYWwgZG9jdW1lbnQsIHdpbmRvdywgbmF2aWdhdG9yLCBsb2NhdGlvbiwgWE1MSHR0cFJlcXVlc3QsIFhEb21haW5SZXF1ZXN0Ki9cblxuICB2YXIgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgdmFyIG9wdGlvbnM7XG4gIHZhciB1c2VyQWdlbnQgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudDtcbiAgdmFyIHZpZXdwb3J0VW5pdEV4cHJlc3Npb24gPSAvKFsrLV0/WzAtOS5dKykodmh8dnd8dm1pbnx2bWF4KS9nO1xuICB2YXIgZm9yRWFjaCA9IFtdLmZvckVhY2g7XG4gIHZhciBkaW1lbnNpb25zO1xuICB2YXIgZGVjbGFyYXRpb25zO1xuICB2YXIgc3R5bGVOb2RlO1xuICB2YXIgaXNCdWdneUlFID0gZmFsc2U7XG4gIHZhciBpc09sZElFID0gZmFsc2U7XG4gIHZhciBpc09wZXJhTWluaSA9IHVzZXJBZ2VudC5pbmRleE9mKCdPcGVyYSBNaW5pJykgPiAtMTtcblxuICB2YXIgaXNNb2JpbGVTYWZhcmkgPSAvKGlQaG9uZXxpUG9kfGlQYWQpLitBcHBsZVdlYktpdC9pLnRlc3QodXNlckFnZW50KSAmJiAoZnVuY3Rpb24oKSB7XG4gICAgLy8gUmVnZXhwIGZvciBpT1MtdmVyc2lvbiB0ZXN0ZWQgYWdhaW5zdCB0aGUgZm9sbG93aW5nIHVzZXJBZ2VudCBzdHJpbmdzOlxuICAgIC8vIEV4YW1wbGUgV2ViVmlldyBVc2VyQWdlbnRzOlxuICAgIC8vICogaU9TIENocm9tZSBvbiBpT1M4OiBcIk1vemlsbGEvNS4wIChpUGFkOyBDUFUgT1MgOF8xIGxpa2UgTWFjIE9TIFgpIEFwcGxlV2ViS2l0LzYwMC4xLjQgKEtIVE1MLCBsaWtlIEdlY2tvKSBDcmlPUy8zOS4wLjIxNzEuNTAgTW9iaWxlLzEyQjQxMCBTYWZhcmkvNjAwLjEuNFwiXG4gICAgLy8gKiBpT1MgRmFjZWJvb2sgb24gaU9TNzogXCJNb3ppbGxhLzUuMCAoaVBob25lOyBDUFUgaVBob25lIE9TIDdfMV8xIGxpa2UgTWFjIE9TIFgpIEFwcGxlV2ViS2l0LzUzNy41MS4yIChLSFRNTCwgbGlrZSBHZWNrbykgTW9iaWxlLzExRDIwMSBbRkJBTi9GQklPUztGQkFWLzEyLjEuMC4yNC4yMDsgRkJCVi8zMjE0MjQ3OyBGQkRWL2lQaG9uZTYsMTtGQk1EL2lQaG9uZTsgRkJTTi9pUGhvbmUgT1M7RkJTVi83LjEuMTsgRkJTUy8yOyBGQkNSL0FUJlQ7RkJJRC9waG9uZTtGQkxDL2VuX1VTO0ZCT1AvNV1cIlxuICAgIC8vIEV4YW1wbGUgU2FmYXJpIFVzZXJBZ2VudHM6XG4gICAgLy8gKiBTYWZhcmkgaU9TODogXCJNb3ppbGxhLzUuMCAoaVBob25lOyBDUFUgaVBob25lIE9TIDhfMCBsaWtlIE1hYyBPUyBYKSBBcHBsZVdlYktpdC82MDAuMS4zIChLSFRNTCwgbGlrZSBHZWNrbykgVmVyc2lvbi84LjAgTW9iaWxlLzEyQTQzNDVkIFNhZmFyaS82MDAuMS40XCJcbiAgICAvLyAqIFNhZmFyaSBpT1M3OiBcIk1vemlsbGEvNS4wIChpUGhvbmU7IENQVSBpUGhvbmUgT1MgN18wIGxpa2UgTWFjIE9TIFgpIEFwcGxlV2ViS2l0LzUzNy41MS4xIChLSFRNTCwgbGlrZSBHZWNrbykgVmVyc2lvbi83LjAgTW9iaWxlLzExQTQ0NDlkIFNhZmFyaS85NTM3LjUzXCJcbiAgICB2YXIgaU9TdmVyc2lvbiA9IHVzZXJBZ2VudC5tYXRjaCgvT1MgKFxcZCkvKTtcbiAgICAvLyB2aWV3cG9ydCB1bml0cyB3b3JrIGZpbmUgaW4gbW9iaWxlIFNhZmFyaSBhbmQgd2ViVmlldyBvbiBpT1MgOCtcbiAgICByZXR1cm4gaU9TdmVyc2lvbiAmJiBpT1N2ZXJzaW9uLmxlbmd0aD4xICYmIHBhcnNlSW50KGlPU3ZlcnNpb25bMV0pIDwgODtcbiAgfSkoKTtcblxuICB2YXIgaXNCYWRTdG9ja0FuZHJvaWQgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gQW5kcm9pZCBzdG9jayBicm93c2VyIHRlc3QgZGVyaXZlZCBmcm9tXG4gICAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8yNDkyNjIyMS9kaXN0aW5ndWlzaC1hbmRyb2lkLWNocm9tZS1mcm9tLXN0b2NrLWJyb3dzZXItc3RvY2stYnJvd3NlcnMtdXNlci1hZ2VudC1jb250YWlcbiAgICB2YXIgaXNBbmRyb2lkID0gdXNlckFnZW50LmluZGV4T2YoJyBBbmRyb2lkICcpID4gLTE7XG4gICAgaWYgKCFpc0FuZHJvaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaXNTdG9ja0FuZHJvaWQgPSB1c2VyQWdlbnQuaW5kZXhPZignVmVyc2lvbi8nKSA+IC0xO1xuICAgIGlmICghaXNTdG9ja0FuZHJvaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgdmVyc2lvbk51bWJlciA9IHBhcnNlRmxvYXQoKHVzZXJBZ2VudC5tYXRjaCgnQW5kcm9pZCAoWzAtOS5dKyknKSB8fCBbXSlbMV0pO1xuICAgIC8vIGFueXRoaW5nIGJlbG93IDQuNCB1c2VzIFdlYktpdCB3aXRob3V0ICphbnkqIHZpZXdwb3J0IHN1cHBvcnQsXG4gICAgLy8gNC40IGhhcyBpc3N1ZXMgd2l0aCB2aWV3cG9ydCB1bml0cyB3aXRoaW4gY2FsYygpXG4gICAgcmV0dXJuIHZlcnNpb25OdW1iZXIgPD0gNC40O1xuICB9KSgpO1xuXG4gIC8vIERvIG5vdCByZW1vdmUgdGhlIGZvbGxvd2luZyBjb21tZW50IVxuICAvLyBJdCBpcyBhIGNvbmRpdGlvbmFsIGNvbW1lbnQgdXNlZCB0b1xuICAvLyBpZGVudGlmeSBvbGQgSW50ZXJuZXQgRXhwbG9yZXIgdmVyc2lvbnNcblxuICAvKkBjY19vblxuXG4gIEBpZiAoOSA8PSBAX2pzY3JpcHRfdmVyc2lvbiAmJiBAX2pzY3JpcHRfdmVyc2lvbiA8PSAxMClcbiAgICBpc0J1Z2d5SUUgPSB0cnVlO1xuICBAZW5kXG4gIFxuICBAaWYgKEBfanNjcmlwdF92ZXJzaW9uIDwgOSkge1xuICAgIGlzT2xkSUUgPSB0cnVlO1xuICB9XG4gIEBlbmRcbiAgXG4gIEAqL1xuXG4gIC8vIGFkZGVkIGNoZWNrIGZvciBJRTExLCBzaW5jZSBpdCAqc3RpbGwqIGRvZXNuJ3QgdW5kZXJzdGFuZCB2bWF4ISEhXG4gIGlmICghaXNCdWdneUlFKSB7XG4gICAgaXNCdWdneUlFID0gISFuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC9UcmlkZW50LipydlsgOl0qMTFcXC4vKTtcbiAgfVxuICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0KSB7XG4gICAgdmFyIHRpbWVvdXQ7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzO1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB2YXIgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIH07XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNhbGxiYWNrLCB3YWl0KTtcbiAgICB9O1xuICB9XG5cbiAgLy8gZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzMyNjA2OS9ob3ctdG8taWRlbnRpZnktaWYtYS13ZWJwYWdlLWlzLWJlaW5nLWxvYWRlZC1pbnNpZGUtYW4taWZyYW1lLW9yLWRpcmVjdGx5LWludG8tdFxuICBmdW5jdGlvbiBpbklmcmFtZSgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHdpbmRvdy5zZWxmICE9PSB3aW5kb3cudG9wO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXRpYWxpemUoaW5pdE9wdGlvbnMpIHtcbiAgICBpZiAoaW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaW5pdE9wdGlvbnMgPT09IHRydWUpIHtcbiAgICAgIGluaXRPcHRpb25zID0ge1xuICAgICAgICBmb3JjZTogdHJ1ZVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMgfHwge307XG4gICAgb3B0aW9ucy5pc01vYmlsZVNhZmFyaSA9IGlzTW9iaWxlU2FmYXJpO1xuICAgIG9wdGlvbnMuaXNCYWRTdG9ja0FuZHJvaWQgPSBpc0JhZFN0b2NrQW5kcm9pZDtcblxuICAgIGlmIChpc09sZElFIHx8ICghb3B0aW9ucy5mb3JjZSAmJiAhaXNNb2JpbGVTYWZhcmkgJiYgIWlzQnVnZ3lJRSAmJiAhaXNCYWRTdG9ja0FuZHJvaWQgJiYgIWlzT3BlcmFNaW5pICYmICghb3B0aW9ucy5oYWNrcyB8fCAhb3B0aW9ucy5oYWNrcy5yZXF1aXJlZChvcHRpb25zKSkpKSB7XG4gICAgICAvLyB0aGlzIGJ1Z2d5ZmlsbCBvbmx5IGFwcGxpZXMgdG8gbW9iaWxlIHNhZmFyaSwgSUU5LTEwIGFuZCB0aGUgU3RvY2sgQW5kcm9pZCBCcm93c2VyLlxuICAgICAgaWYgKHdpbmRvdy5jb25zb2xlICYmIGlzT2xkSUUpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKCd2aWV3cG9ydC11bml0cy1idWdneWZpbGwgcmVxdWlyZXMgYSBwcm9wZXIgQ1NTT00gYW5kIGJhc2ljIHZpZXdwb3J0IHVuaXQgc3VwcG9ydCwgd2hpY2ggYXJlIG5vdCBhdmFpbGFibGUgaW4gSUU4IGFuZCBiZWxvdycpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbml0OiBmdW5jdGlvbiAoKSB7fVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBvcHRpb25zLmhhY2tzICYmIG9wdGlvbnMuaGFja3MuaW5pdGlhbGl6ZShvcHRpb25zKTtcblxuICAgIGluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICBzdHlsZU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlTm9kZS5pZCA9ICdwYXRjaGVkLXZpZXdwb3J0JztcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlTm9kZSk7XG5cbiAgICAvLyBJc3N1ZSAjNjogQ3Jvc3MgT3JpZ2luIFN0eWxlc2hlZXRzIGFyZSBub3QgYWNjZXNzaWJsZSB0aHJvdWdoIENTU09NLFxuICAgIC8vIHRoZXJlZm9yZSBkb3dubG9hZCBhbmQgaW5qZWN0IHRoZW0gYXMgPHN0eWxlPiB0byBjaXJjdW12ZW50IFNPUC5cbiAgICBpbXBvcnRDcm9zc09yaWdpbkxpbmtzKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIF9yZWZyZXNoID0gZGVib3VuY2UocmVmcmVzaCwgb3B0aW9ucy5yZWZyZXNoRGVib3VuY2VXYWl0IHx8IDEwMCk7XG4gICAgICAvLyBkb2luZyBhIGZ1bGwgcmVmcmVzaCByYXRoZXIgdGhhbiB1cGRhdGVTdHlsZXMgYmVjYXVzZSBhbiBvcmllbnRhdGlvbmNoYW5nZVxuICAgICAgLy8gY291bGQgYWN0aXZhdGUgZGlmZmVyZW50IHN0eWxlc2hlZXRzXG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb3JpZW50YXRpb25jaGFuZ2UnLCBfcmVmcmVzaCwgdHJ1ZSk7XG4gICAgICAvLyBvcmllbnRhdGlvbmNoYW5nZSBtaWdodCBoYXZlIGhhcHBlbmVkIHdoaWxlIGluIGEgZGlmZmVyZW50IHdpbmRvd1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BhZ2VzaG93JywgX3JlZnJlc2gsIHRydWUpO1xuXG4gICAgICBpZiAob3B0aW9ucy5mb3JjZSB8fCBpc0J1Z2d5SUUgfHwgaW5JZnJhbWUoKSkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX3JlZnJlc2gsIHRydWUpO1xuICAgICAgICBvcHRpb25zLl9saXN0ZW5pbmdUb1Jlc2l6ZSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIG9wdGlvbnMuaGFja3MgJiYgb3B0aW9ucy5oYWNrcy5pbml0aWFsaXplRXZlbnRzKG9wdGlvbnMsIHJlZnJlc2gsIF9yZWZyZXNoKTtcblxuICAgICAgcmVmcmVzaCgpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU3R5bGVzKCkge1xuICAgIHN0eWxlTm9kZS50ZXh0Q29udGVudCA9IGdldFJlcGxhY2VkVmlld3BvcnRVbml0cygpO1xuICAgIC8vIG1vdmUgdG8gdGhlIGVuZCBpbiBjYXNlIGlubGluZSA8c3R5bGU+cyB3ZXJlIGFkZGVkIGR5bmFtaWNhbGx5XG4gICAgc3R5bGVOb2RlLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQoc3R5bGVOb2RlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2goKSB7XG4gICAgaWYgKCFpbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZpbmRQcm9wZXJ0aWVzKCk7XG5cbiAgICAvLyBpT1MgU2FmYXJpIHdpbGwgcmVwb3J0IHdpbmRvdy5pbm5lcldpZHRoIGFuZCAuaW5uZXJIZWlnaHQgYXMgMCB1bmxlc3MgYSB0aW1lb3V0IGlzIHVzZWQgaGVyZS5cbiAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IFdIWSBpbm5lcldpZHRoID09PSAwXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIHVwZGF0ZVN0eWxlcygpO1xuICAgIH0sIDEpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZFByb3BlcnRpZXMoKSB7XG4gICAgZGVjbGFyYXRpb25zID0gW107XG4gICAgZm9yRWFjaC5jYWxsKGRvY3VtZW50LnN0eWxlU2hlZXRzLCBmdW5jdGlvbihzaGVldCkge1xuICAgICAgaWYgKHNoZWV0Lm93bmVyTm9kZS5pZCA9PT0gJ3BhdGNoZWQtdmlld3BvcnQnIHx8ICFzaGVldC5jc3NSdWxlcyB8fCBzaGVldC5vd25lck5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLXZpZXdwb3J0LXVuaXRzLWJ1Z2d5ZmlsbCcpID09PSAnaWdub3JlJykge1xuICAgICAgICAvLyBza2lwIGVudGlyZSBzaGVldCBiZWNhdXNlIG5vIHJ1bGVzIGFyZSBwcmVzZW50LCBpdCdzIHN1cHBvc2VkIHRvIGJlIGlnbm9yZWQgb3IgaXQncyB0aGUgdGFyZ2V0LWVsZW1lbnQgb2YgdGhlIGJ1Z2d5ZmlsbFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChzaGVldC5tZWRpYSAmJiBzaGVldC5tZWRpYS5tZWRpYVRleHQgJiYgd2luZG93Lm1hdGNoTWVkaWEgJiYgIXdpbmRvdy5tYXRjaE1lZGlhKHNoZWV0Lm1lZGlhLm1lZGlhVGV4dCkubWF0Y2hlcykge1xuICAgICAgICAvLyBza2lwIGVudGlyZSBzaGVldCBiZWNhdXNlIG1lZGlhIGF0dHJpYnV0ZSBkb2Vzbid0IG1hdGNoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZm9yRWFjaC5jYWxsKHNoZWV0LmNzc1J1bGVzLCBmaW5kRGVjbGFyYXRpb25zKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBkZWNsYXJhdGlvbnM7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kRGVjbGFyYXRpb25zKHJ1bGUpIHtcbiAgICBpZiAocnVsZS50eXBlID09PSA3KSB7XG4gICAgICB2YXIgdmFsdWU7XG5cbiAgICAgIC8vIHRoZXJlIG1heSBiZSBhIGNhc2Ugd2hlcmUgYWNjZXNzaW5nIGNzc1RleHQgdGhyb3dzIGFuIGVycm9yLlxuICAgICAgLy8gSSBjb3VsZCBub3QgcmVwcm9kdWNlIHRoaXMgaXNzdWUsIGJ1dCB0aGUgd29yc3QgdGhhdCBjYW4gaGFwcGVuXG4gICAgICAvLyB0aGlzIHdheSBpcyBhbiBhbmltYXRpb24gbm90IHJ1bm5pbmcgcHJvcGVybHkuXG4gICAgICAvLyBub3QgYXdlc29tZSwgYnV0IHByb2JhYmx5IGJldHRlciB0aGFuIGEgc2NyaXB0IGVycm9yXG4gICAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3JvZG5leXJlaG0vdmlld3BvcnQtdW5pdHMtYnVnZ3lmaWxsL2lzc3Vlcy8yMVxuICAgICAgdHJ5IHtcbiAgICAgICAgdmFsdWUgPSBydWxlLmNzc1RleHQ7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2aWV3cG9ydFVuaXRFeHByZXNzaW9uLmxhc3RJbmRleCA9IDA7XG4gICAgICBpZiAodmlld3BvcnRVbml0RXhwcmVzc2lvbi50ZXN0KHZhbHVlKSkge1xuICAgICAgICAvLyBLZXlmcmFtZXNSdWxlIGRvZXMgbm90IGhhdmUgYSBDU1MtUHJvcGVydHlOYW1lXG4gICAgICAgIGRlY2xhcmF0aW9ucy5wdXNoKFtydWxlLCBudWxsLCB2YWx1ZV0pO1xuICAgICAgICBvcHRpb25zLmhhY2tzICYmIG9wdGlvbnMuaGFja3MuZmluZERlY2xhcmF0aW9ucyhkZWNsYXJhdGlvbnMsIHJ1bGUsIG51bGwsIHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghcnVsZS5zdHlsZSkge1xuICAgICAgaWYgKCFydWxlLmNzc1J1bGVzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZm9yRWFjaC5jYWxsKHJ1bGUuY3NzUnVsZXMsIGZ1bmN0aW9uKF9ydWxlKSB7XG4gICAgICAgIGZpbmREZWNsYXJhdGlvbnMoX3J1bGUpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3JFYWNoLmNhbGwocnVsZS5zdHlsZSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIHZhbHVlID0gcnVsZS5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKG5hbWUpO1xuICAgICAgLy8gcHJlc2VydmUgdGhvc2UgIWltcG9ydGFudCBydWxlc1xuICAgICAgaWYgKHJ1bGUuc3R5bGUuZ2V0UHJvcGVydHlQcmlvcml0eShuYW1lKSkge1xuICAgICAgICB2YWx1ZSArPSAnICFpbXBvcnRhbnQnO1xuICAgICAgfVxuXG4gICAgICB2aWV3cG9ydFVuaXRFeHByZXNzaW9uLmxhc3RJbmRleCA9IDA7XG4gICAgICBpZiAodmlld3BvcnRVbml0RXhwcmVzc2lvbi50ZXN0KHZhbHVlKSkge1xuICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChbcnVsZSwgbmFtZSwgdmFsdWVdKTtcbiAgICAgICAgb3B0aW9ucy5oYWNrcyAmJiBvcHRpb25zLmhhY2tzLmZpbmREZWNsYXJhdGlvbnMoZGVjbGFyYXRpb25zLCBydWxlLCBuYW1lLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRSZXBsYWNlZFZpZXdwb3J0VW5pdHMoKSB7XG4gICAgZGltZW5zaW9ucyA9IGdldFZpZXdwb3J0KCk7XG5cbiAgICB2YXIgY3NzID0gW107XG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIHZhciBvcGVuO1xuICAgIHZhciBjbG9zZTtcblxuICAgIGRlY2xhcmF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHZhciBfaXRlbSA9IG92ZXJ3cml0ZURlY2xhcmF0aW9uLmFwcGx5KG51bGwsIGl0ZW0pO1xuICAgICAgdmFyIF9vcGVuID0gX2l0ZW0uc2VsZWN0b3IubGVuZ3RoID8gKF9pdGVtLnNlbGVjdG9yLmpvaW4oJyB7XFxuJykgKyAnIHtcXG4nKSA6ICcnO1xuICAgICAgdmFyIF9jbG9zZSA9IG5ldyBBcnJheShfaXRlbS5zZWxlY3Rvci5sZW5ndGggKyAxKS5qb2luKCdcXG59Jyk7XG5cbiAgICAgIGlmICghX29wZW4gfHwgX29wZW4gIT09IG9wZW4pIHtcbiAgICAgICAgaWYgKGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICBjc3MucHVzaChvcGVuICsgYnVmZmVyLmpvaW4oJ1xcbicpICsgY2xvc2UpO1xuICAgICAgICAgIGJ1ZmZlci5sZW5ndGggPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9vcGVuKSB7XG4gICAgICAgICAgb3BlbiA9IF9vcGVuO1xuICAgICAgICAgIGNsb3NlID0gX2Nsb3NlO1xuICAgICAgICAgIGJ1ZmZlci5wdXNoKF9pdGVtLmNvbnRlbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNzcy5wdXNoKF9pdGVtLmNvbnRlbnQpO1xuICAgICAgICAgIG9wZW4gPSBudWxsO1xuICAgICAgICAgIGNsb3NlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKF9vcGVuICYmICFvcGVuKSB7XG4gICAgICAgIG9wZW4gPSBfb3BlbjtcbiAgICAgICAgY2xvc2UgPSBfY2xvc2U7XG4gICAgICB9XG5cbiAgICAgIGJ1ZmZlci5wdXNoKF9pdGVtLmNvbnRlbnQpO1xuICAgIH0pO1xuXG4gICAgaWYgKGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGNzcy5wdXNoKG9wZW4gKyBidWZmZXIuam9pbignXFxuJykgKyBjbG9zZSk7XG4gICAgfVxuXG4gICAgLy8gT3BlcmEgTWluaSBtZXNzZXMgdXAgb24gdGhlIGNvbnRlbnQgaGFjayAoaXQgcmVwbGFjZXMgdGhlIERPTSBub2RlJ3MgaW5uZXJIVE1MIHdpdGggdGhlIHZhbHVlKS5cbiAgICAvLyBUaGlzIGZpeGVzIGl0LiBXZSB0ZXN0IGZvciBPcGVyYSBNaW5pIG9ubHkgc2luY2UgaXQgaXMgdGhlIG1vc3QgZXhwZW5zaXZlIENTUyBzZWxlY3RvclxuICAgIC8vIHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvVW5pdmVyc2FsX3NlbGVjdG9yc1xuICAgIGlmIChpc09wZXJhTWluaSkge1xuICAgICAgY3NzLnB1c2goJyogeyBjb250ZW50OiBub3JtYWwgIWltcG9ydGFudDsgfScpO1xuICAgIH1cblxuICAgIHJldHVybiBjc3Muam9pbignXFxuXFxuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBvdmVyd3JpdGVEZWNsYXJhdGlvbihydWxlLCBuYW1lLCB2YWx1ZSkge1xuICAgIHZhciBfdmFsdWU7XG4gICAgdmFyIF9zZWxlY3RvcnMgPSBbXTtcblxuICAgIF92YWx1ZSA9IHZhbHVlLnJlcGxhY2Uodmlld3BvcnRVbml0RXhwcmVzc2lvbiwgcmVwbGFjZVZhbHVlcyk7XG5cbiAgICBpZiAob3B0aW9ucy5oYWNrcykge1xuICAgICAgX3ZhbHVlID0gb3B0aW9ucy5oYWNrcy5vdmVyd3JpdGVEZWNsYXJhdGlvbihydWxlLCBuYW1lLCBfdmFsdWUpO1xuICAgIH1cblxuICAgIGlmIChuYW1lKSB7XG4gICAgICAvLyBza2lwcGluZyBLZXlmcmFtZXNSdWxlXG4gICAgICBfc2VsZWN0b3JzLnB1c2gocnVsZS5zZWxlY3RvclRleHQpO1xuICAgICAgX3ZhbHVlID0gbmFtZSArICc6ICcgKyBfdmFsdWUgKyAnOyc7XG4gICAgfVxuXG4gICAgdmFyIF9ydWxlID0gcnVsZS5wYXJlbnRSdWxlO1xuICAgIHdoaWxlIChfcnVsZSkge1xuICAgICAgX3NlbGVjdG9ycy51bnNoaWZ0KCdAbWVkaWEgJyArIF9ydWxlLm1lZGlhLm1lZGlhVGV4dCk7XG4gICAgICBfcnVsZSA9IF9ydWxlLnBhcmVudFJ1bGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNlbGVjdG9yOiBfc2VsZWN0b3JzLFxuICAgICAgY29udGVudDogX3ZhbHVlXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2VWYWx1ZXMobWF0Y2gsIG51bWJlciwgdW5pdCkge1xuICAgIHZhciBfYmFzZSA9IGRpbWVuc2lvbnNbdW5pdF07XG4gICAgdmFyIF9udW1iZXIgPSBwYXJzZUZsb2F0KG51bWJlcikgLyAxMDA7XG4gICAgcmV0dXJuIChfbnVtYmVyICogX2Jhc2UpICsgJ3B4JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFZpZXdwb3J0KCkge1xuICAgIHZhciB2aCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICB2YXIgdncgPSB3aW5kb3cuaW5uZXJXaWR0aDtcblxuICAgIHJldHVybiB7XG4gICAgICB2aDogdmgsXG4gICAgICB2dzogdncsXG4gICAgICB2bWF4OiBNYXRoLm1heCh2dywgdmgpLFxuICAgICAgdm1pbjogTWF0aC5taW4odncsIHZoKVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBpbXBvcnRDcm9zc09yaWdpbkxpbmtzKG5leHQpIHtcbiAgICB2YXIgX3dhaXRpbmcgPSAwO1xuICAgIHZhciBkZWNyZWFzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgX3dhaXRpbmctLTtcbiAgICAgIGlmICghX3dhaXRpbmcpIHtcbiAgICAgICAgbmV4dCgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmb3JFYWNoLmNhbGwoZG9jdW1lbnQuc3R5bGVTaGVldHMsIGZ1bmN0aW9uKHNoZWV0KSB7XG4gICAgICBpZiAoIXNoZWV0LmhyZWYgfHwgb3JpZ2luKHNoZWV0LmhyZWYpID09PSBvcmlnaW4obG9jYXRpb24uaHJlZikgfHwgc2hlZXQub3duZXJOb2RlLmdldEF0dHJpYnV0ZSgnZGF0YS12aWV3cG9ydC11bml0cy1idWdneWZpbGwnKSA9PT0gJ2lnbm9yZScpIHtcbiAgICAgICAgLy8gc2tpcCA8c3R5bGU+IGFuZCA8bGluaz4gZnJvbSBzYW1lIG9yaWdpbiBvciBleHBsaWNpdGx5IGRlY2xhcmVkIHRvIGlnbm9yZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIF93YWl0aW5nKys7XG4gICAgICBjb252ZXJ0TGlua1RvU3R5bGUoc2hlZXQub3duZXJOb2RlLCBkZWNyZWFzZSk7XG4gICAgfSk7XG5cbiAgICBpZiAoIV93YWl0aW5nKSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb3JpZ2luKHVybCkge1xuICAgIHJldHVybiB1cmwuc2xpY2UoMCwgdXJsLmluZGV4T2YoJy8nLCB1cmwuaW5kZXhPZignOi8vJykgKyAzKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb252ZXJ0TGlua1RvU3R5bGUobGluaywgbmV4dCkge1xuICAgIGdldENvcnMobGluay5ocmVmLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICBzdHlsZS5tZWRpYSA9IGxpbmsubWVkaWE7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtaHJlZicsIGxpbmsuaHJlZik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgbGluay5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdHlsZSwgbGluayk7XG4gICAgICBuZXh0KCk7XG4gICAgfSwgbmV4dCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRDb3JzKHVybCwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgaWYgKCd3aXRoQ3JlZGVudGlhbHMnIGluIHhocikge1xuICAgICAgLy8gWEhSIGZvciBDaHJvbWUvRmlyZWZveC9PcGVyYS9TYWZhcmkuXG4gICAgICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIFhEb21haW5SZXF1ZXN0IGZvciBJRS5cbiAgICAgIHhociA9IG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY3Jvc3MtZG9tYWluIFhIUiBub3Qgc3VwcG9ydGVkJyk7XG4gICAgfVxuXG4gICAgeGhyLm9ubG9hZCA9IHN1Y2Nlc3M7XG4gICAgeGhyLm9uZXJyb3IgPSBlcnJvcjtcbiAgICB4aHIuc2VuZCgpO1xuICAgIHJldHVybiB4aHI7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHZlcnNpb246ICcwLjUuMycsXG4gICAgZmluZFByb3BlcnRpZXM6IGZpbmRQcm9wZXJ0aWVzLFxuICAgIGdldENzczogZ2V0UmVwbGFjZWRWaWV3cG9ydFVuaXRzLFxuICAgIGluaXQ6IGluaXRpYWxpemUsXG4gICAgcmVmcmVzaDogcmVmcmVzaFxuICB9O1xuXG59KSk7XG4iXSwiZmlsZSI6InZpZXdwb3J0LXVuaXRzLWJ1Z2d5ZmlsbC5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
/*!
 * viewport-units-buggyfill.hacks v0.5.3
 * @web: https://github.com/rodneyrehm/viewport-units-buggyfill/
 * @author: Zoltan Hawryluk - http://www.useragentman.com/
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.viewportUnitsBuggyfillHacks = factory();
  }
}(this, function () {
  'use strict';

  var options;
  var calcExpression = /calc\(/g;
  var quoteExpression = /[\"\']/g;
  var urlExpression = /url\([^\)]*\)/g;
  var isBuggyIE = false;
  var isOldIE = false;
  var supportsVminmax = true;
  var supportsVminmaxCalc = true;

  // WARNING!
  // Do not remove the following conditional comment.
  // It is required to identify the current version of IE

  /*@cc_on

  @if (9 <= @_jscript_version && @_jscript_version <= 10)
    isBuggyIE = true;
    supportsVminmaxCalc = false;
    supportsVminmax = false;
  @end
  
  @if (@_jscript_version < 9) {
  	isOldIE = true;
  }
  @end
  
  @*/

  // iOS SAFARI, IE9, or Stock Android: abuse "content" if "viewport-units-buggyfill" specified
  function checkHacks(declarations, rule, name, value) {
    var needsHack = name === 'content' && value.indexOf('viewport-units-buggyfill') > -1;
    if (!needsHack) {
      return;
    }

    var fakeRules = value.replace(quoteExpression, '');
    fakeRules.split(';').forEach(function(fakeRuleElement) {
      var fakeRule = fakeRuleElement.split(':');
      if (fakeRule.length !== 2) {
        return;
      }

      var name = fakeRule[0].trim();
      if (name === 'viewport-units-buggyfill') {
        return;
      }

      var value = fakeRule[1].trim();
      declarations.push([rule, name, value]);
      if (calcExpression.test(value)) {
        var webkitValue = value.replace(calcExpression, '-webkit-calc(');
        declarations.push([rule, name, webkitValue]);
      }
    });
  }

  return {
    required: function(options) {
      return options.isMobileSafari || isBuggyIE;
    },

    initialize: function(initOptions) {
      options = initOptions;

      // Test viewport units support in calc() expressions
      var div = document.createElement('div');
      div.style.width = '1vmax';
      supportsVminmax = div.style.width !== '';

      // there is no accurate way to detect this programmatically.
      if (options.isMobileSafari || options.isBadStockAndroid) {
        supportsVminmaxCalc = false;
      }

    },

    initializeEvents: function(options, refresh, _refresh) {
      if (options.force) {
        return;
      }

      if (isBuggyIE && !options._listeningToResize) {
        window.addEventListener('resize', _refresh, true);
        options._listeningToResize = true;
      }
    },

    findDeclarations: function(declarations, rule, name, value) {
      if (name === null) {
        // KeyframesRule does not have a CSS-PropertyName
        return;
      }

      checkHacks(declarations, rule, name, value);
    },

    overwriteDeclaration: function(rule, name, _value) {
      if (isBuggyIE && name === 'filter') {
        // remove unit "px" from complex value, e.g.:
        // filter: progid:DXImageTransform.Microsoft.DropShadow(OffX=5.4px, OffY=3.9px, Color=#000000);
        _value = _value.replace(/px/g, '');
      }

      return _value;
    }
  };

}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJ2aWV3cG9ydC11bml0cy1idWdneWZpbGwuaGFja3MuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiB2aWV3cG9ydC11bml0cy1idWdneWZpbGwuaGFja3MgdjAuNS4zXG4gKiBAd2ViOiBodHRwczovL2dpdGh1Yi5jb20vcm9kbmV5cmVobS92aWV3cG9ydC11bml0cy1idWdneWZpbGwvXG4gKiBAYXV0aG9yOiBab2x0YW4gSGF3cnlsdWsgLSBodHRwOi8vd3d3LnVzZXJhZ2VudG1hbi5jb20vXG4gKi9cblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cbiAgICBkZWZpbmUoW10sIGZhY3RvcnkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUuIERvZXMgbm90IHdvcmsgd2l0aCBzdHJpY3QgQ29tbW9uSlMsIGJ1dFxuICAgIC8vIG9ubHkgQ29tbW9uSlMtbGlrZSBlbnZpcm9tZW50cyB0aGF0IHN1cHBvcnQgbW9kdWxlLmV4cG9ydHMsXG4gICAgLy8gbGlrZSBOb2RlLlxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFscyAocm9vdCBpcyB3aW5kb3cpXG4gICAgcm9vdC52aWV3cG9ydFVuaXRzQnVnZ3lmaWxsSGFja3MgPSBmYWN0b3J5KCk7XG4gIH1cbn0odGhpcywgZnVuY3Rpb24gKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIG9wdGlvbnM7XG4gIHZhciBjYWxjRXhwcmVzc2lvbiA9IC9jYWxjXFwoL2c7XG4gIHZhciBxdW90ZUV4cHJlc3Npb24gPSAvW1xcXCJcXCddL2c7XG4gIHZhciB1cmxFeHByZXNzaW9uID0gL3VybFxcKFteXFwpXSpcXCkvZztcbiAgdmFyIGlzQnVnZ3lJRSA9IGZhbHNlO1xuICB2YXIgaXNPbGRJRSA9IGZhbHNlO1xuICB2YXIgc3VwcG9ydHNWbWlubWF4ID0gdHJ1ZTtcbiAgdmFyIHN1cHBvcnRzVm1pbm1heENhbGMgPSB0cnVlO1xuXG4gIC8vIFdBUk5JTkchXG4gIC8vIERvIG5vdCByZW1vdmUgdGhlIGZvbGxvd2luZyBjb25kaXRpb25hbCBjb21tZW50LlxuICAvLyBJdCBpcyByZXF1aXJlZCB0byBpZGVudGlmeSB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIElFXG5cbiAgLypAY2Nfb25cblxuICBAaWYgKDkgPD0gQF9qc2NyaXB0X3ZlcnNpb24gJiYgQF9qc2NyaXB0X3ZlcnNpb24gPD0gMTApXG4gICAgaXNCdWdneUlFID0gdHJ1ZTtcbiAgICBzdXBwb3J0c1ZtaW5tYXhDYWxjID0gZmFsc2U7XG4gICAgc3VwcG9ydHNWbWlubWF4ID0gZmFsc2U7XG4gIEBlbmRcbiAgXG4gIEBpZiAoQF9qc2NyaXB0X3ZlcnNpb24gPCA5KSB7XG4gIFx0aXNPbGRJRSA9IHRydWU7XG4gIH1cbiAgQGVuZFxuICBcbiAgQCovXG5cbiAgLy8gaU9TIFNBRkFSSSwgSUU5LCBvciBTdG9jayBBbmRyb2lkOiBhYnVzZSBcImNvbnRlbnRcIiBpZiBcInZpZXdwb3J0LXVuaXRzLWJ1Z2d5ZmlsbFwiIHNwZWNpZmllZFxuICBmdW5jdGlvbiBjaGVja0hhY2tzKGRlY2xhcmF0aW9ucywgcnVsZSwgbmFtZSwgdmFsdWUpIHtcbiAgICB2YXIgbmVlZHNIYWNrID0gbmFtZSA9PT0gJ2NvbnRlbnQnICYmIHZhbHVlLmluZGV4T2YoJ3ZpZXdwb3J0LXVuaXRzLWJ1Z2d5ZmlsbCcpID4gLTE7XG4gICAgaWYgKCFuZWVkc0hhY2spIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZmFrZVJ1bGVzID0gdmFsdWUucmVwbGFjZShxdW90ZUV4cHJlc3Npb24sICcnKTtcbiAgICBmYWtlUnVsZXMuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uKGZha2VSdWxlRWxlbWVudCkge1xuICAgICAgdmFyIGZha2VSdWxlID0gZmFrZVJ1bGVFbGVtZW50LnNwbGl0KCc6Jyk7XG4gICAgICBpZiAoZmFrZVJ1bGUubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIG5hbWUgPSBmYWtlUnVsZVswXS50cmltKCk7XG4gICAgICBpZiAobmFtZSA9PT0gJ3ZpZXdwb3J0LXVuaXRzLWJ1Z2d5ZmlsbCcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWUgPSBmYWtlUnVsZVsxXS50cmltKCk7XG4gICAgICBkZWNsYXJhdGlvbnMucHVzaChbcnVsZSwgbmFtZSwgdmFsdWVdKTtcbiAgICAgIGlmIChjYWxjRXhwcmVzc2lvbi50ZXN0KHZhbHVlKSkge1xuICAgICAgICB2YXIgd2Via2l0VmFsdWUgPSB2YWx1ZS5yZXBsYWNlKGNhbGNFeHByZXNzaW9uLCAnLXdlYmtpdC1jYWxjKCcpO1xuICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChbcnVsZSwgbmFtZSwgd2Via2l0VmFsdWVdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcmVxdWlyZWQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmlzTW9iaWxlU2FmYXJpIHx8IGlzQnVnZ3lJRTtcbiAgICB9LFxuXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oaW5pdE9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucztcblxuICAgICAgLy8gVGVzdCB2aWV3cG9ydCB1bml0cyBzdXBwb3J0IGluIGNhbGMoKSBleHByZXNzaW9uc1xuICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgZGl2LnN0eWxlLndpZHRoID0gJzF2bWF4JztcbiAgICAgIHN1cHBvcnRzVm1pbm1heCA9IGRpdi5zdHlsZS53aWR0aCAhPT0gJyc7XG5cbiAgICAgIC8vIHRoZXJlIGlzIG5vIGFjY3VyYXRlIHdheSB0byBkZXRlY3QgdGhpcyBwcm9ncmFtbWF0aWNhbGx5LlxuICAgICAgaWYgKG9wdGlvbnMuaXNNb2JpbGVTYWZhcmkgfHwgb3B0aW9ucy5pc0JhZFN0b2NrQW5kcm9pZCkge1xuICAgICAgICBzdXBwb3J0c1ZtaW5tYXhDYWxjID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgaW5pdGlhbGl6ZUV2ZW50czogZnVuY3Rpb24ob3B0aW9ucywgcmVmcmVzaCwgX3JlZnJlc2gpIHtcbiAgICAgIGlmIChvcHRpb25zLmZvcmNlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzQnVnZ3lJRSAmJiAhb3B0aW9ucy5fbGlzdGVuaW5nVG9SZXNpemUpIHtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZWZyZXNoLCB0cnVlKTtcbiAgICAgICAgb3B0aW9ucy5fbGlzdGVuaW5nVG9SZXNpemUgPSB0cnVlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBmaW5kRGVjbGFyYXRpb25zOiBmdW5jdGlvbihkZWNsYXJhdGlvbnMsIHJ1bGUsIG5hbWUsIHZhbHVlKSB7XG4gICAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBLZXlmcmFtZXNSdWxlIGRvZXMgbm90IGhhdmUgYSBDU1MtUHJvcGVydHlOYW1lXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY2hlY2tIYWNrcyhkZWNsYXJhdGlvbnMsIHJ1bGUsIG5hbWUsIHZhbHVlKTtcbiAgICB9LFxuXG4gICAgb3ZlcndyaXRlRGVjbGFyYXRpb246IGZ1bmN0aW9uKHJ1bGUsIG5hbWUsIF92YWx1ZSkge1xuICAgICAgaWYgKGlzQnVnZ3lJRSAmJiBuYW1lID09PSAnZmlsdGVyJykge1xuICAgICAgICAvLyByZW1vdmUgdW5pdCBcInB4XCIgZnJvbSBjb21wbGV4IHZhbHVlLCBlLmcuOlxuICAgICAgICAvLyBmaWx0ZXI6IHByb2dpZDpEWEltYWdlVHJhbnNmb3JtLk1pY3Jvc29mdC5Ecm9wU2hhZG93KE9mZlg9NS40cHgsIE9mZlk9My45cHgsIENvbG9yPSMwMDAwMDApO1xuICAgICAgICBfdmFsdWUgPSBfdmFsdWUucmVwbGFjZSgvcHgvZywgJycpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gX3ZhbHVlO1xuICAgIH1cbiAgfTtcblxufSkpO1xuIl0sImZpbGUiOiJ2aWV3cG9ydC11bml0cy1idWdneWZpbGwuaGFja3MuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==