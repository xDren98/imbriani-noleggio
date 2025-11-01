/* fix: WhatsApp safe message formatting - ASCII separators, supported emoji only */
(function(){
  if (!window.buildPreventivoMessage) return;
  const oldBuilder = window.buildPreventivoMessage;
  window.buildPreventivoMessage = function(){
    try {
      const msg = oldBuilder();
      // Replace any box-drawing or non-ASCII separators with ASCII dashes
      return msg
        .replace(/[\u2500-\u257F]+/g, '--------------------')
        .replace(/\u2028|\u2029/g, '\n');
    } catch(e) {
      return oldBuilder();
    }
  };
})();