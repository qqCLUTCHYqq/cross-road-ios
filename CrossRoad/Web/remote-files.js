// Read-only remote file adapter. All input/audio/render code remains unchanged.
const remoteBlocks = new Map();
const REMOTE_MEMORY_BLOCKS = 24;
function remoteFileSource(file) {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.blockSize !== 1048576 || !/^Content\//.test(file.webkitRelativePath)) throw Error('Invalid remote Content descriptor');
  return { size: file.size, read(offset, length) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw Error('Invalid Content offset');
    if (offset >= file.size) return new Uint8Array();
    const end = length > 0 ? Math.min(file.size, offset + length) : file.size;
    const output = new Uint8Array(end - offset);
    for (let position = offset; position < end;) {
      const start = Math.floor(position / file.blockSize) * file.blockSize;
      const key = file.webkitRelativePath + ':' + start;
      let block = remoteBlocks.get(key);
      if (block) { remoteBlocks.delete(key); remoteBlocks.set(key, block); }
      else {
        const url = new URL('./__content', self.location.href);
        url.searchParams.set('path', file.webkitRelativePath);
        url.searchParams.set('offset', String(start));
        url.searchParams.set('version', file.version);
        const request = new XMLHttpRequest();
        request.open('GET', url.href, false);
        request.responseType = 'arraybuffer';
        request.send();
        const expected = Math.min(file.blockSize, file.size - start);
        if (request.status !== 200 || !(request.response instanceof ArrayBuffer) || request.response.byteLength !== expected) throw Error('Content read failed: ' + file.webkitRelativePath + ' at ' + start + ' (HTTP ' + request.status + '). Check connection and reload.');
        block = new Uint8Array(request.response);
        remoteBlocks.set(key, block);
        while (remoteBlocks.size > REMOTE_MEMORY_BLOCKS) remoteBlocks.delete(remoteBlocks.keys().next().value);
      }
      const count = Math.min(end - position, block.length - (position - start));
      output.set(block.subarray(position - start, position - start + count), position - offset);
      position += count;
    }
    return output;
  }};
}
