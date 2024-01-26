function copyUrl() {
  copyUrlToClipboard(window.location.href);
}

function copyUrlToClipboard(shareUrl) {
  var urlField = document.createElement('textarea');
  urlField.value = shareUrl;
  document.body.appendChild(urlField);
  urlField.select();
  document.execCommand('copy');
  document.body.removeChild(urlField);
  alert('URL Copied');
}


function shareOnLinkedIn(shareUrl) {
  var shareText = document.title;
  window.open(
    'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(shareText),
    'linkedin-share-dialog',
    'width=626,height=436');
}