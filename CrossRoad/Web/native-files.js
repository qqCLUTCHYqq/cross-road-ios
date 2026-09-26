// Worker-side synchronous ranged reads from the app's loopback file service.
// The bounded LRU prevents every native read from becoming an HTTP request.
const nativeBlockCache = new Map();
const NATIVE_BLOCK = 262144, NATIVE_CACHE_BLOCKS = 32;
function nativeFileSource(file) {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || typeof file.id !== 'string') throw Error('Invalid native asset descriptor');
  return {size:file.size,read(offset,length){
    if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid file offset');
    if(offset>=file.size)return new Uint8Array();
    const end=length>0?Math.min(file.size,offset+length):file.size;
    const output=new Uint8Array(end-offset);
    for(let position=offset;position<end;){
      const blockStart=Math.floor(position/NATIVE_BLOCK)*NATIVE_BLOCK;
      const key=file.id+':'+blockStart;
      let block=nativeBlockCache.get(key);
      if(block){nativeBlockCache.delete(key);nativeBlockCache.set(key,block);}
      else {
        const count=Math.min(NATIVE_BLOCK,file.size-blockStart);
        const url=new URL('native/file',self.location.href);
        url.searchParams.set('id',file.id);url.searchParams.set('offset',String(blockStart));url.searchParams.set('length',String(count));
        const request=new XMLHttpRequest();request.open('GET',url.href,false);request.responseType='arraybuffer';request.send();
        if(request.status!==200||!(request.response instanceof ArrayBuffer)||request.response.byteLength!==count)throw Error('Native file read failed: '+file.webkitRelativePath+' at '+blockStart+' (HTTP '+request.status+')');
        block=new Uint8Array(request.response);nativeBlockCache.set(key,block);
        while(nativeBlockCache.size>NATIVE_CACHE_BLOCKS)nativeBlockCache.delete(nativeBlockCache.keys().next().value);
      }
      const take=Math.min(end-position,block.length-(position-blockStart));
      output.set(block.subarray(position-blockStart,position-blockStart+take),position-offset);position+=take;
    }
    return output;
  }};
}
