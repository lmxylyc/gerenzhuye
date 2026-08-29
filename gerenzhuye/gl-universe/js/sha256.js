/* ==========================================================
   GL 层群宇宙 · SHA-256（纯 JS 实现, 零依赖）
   用于账号密码加盐哈希（浏览器本地完成）
   用法: sha256Hex(string) -> 64 位十六进制字符串
   ========================================================== */
(function (root) {
  "use strict";

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(str) {
    var s = unescape(encodeURIComponent(String(str)));
    var len = s.length;
    var bitlenHi = Math.floor(len / 0x20000000); /* len*8 / 2^32 */
    var bitlenLo = (len * 8) >>> 0;
    var padded = new Uint8Array((((len + 8) >> 6) + 1) * 64);
    for (var i = 0; i < len; i++) padded[i] = s.charCodeAt(i) & 0xff;
    padded[len] = 0x80;
    var off = padded.length - 8;
    padded[off] = (bitlenHi >>> 24) & 0xff;
    padded[off + 1] = (bitlenHi >>> 16) & 0xff;
    padded[off + 2] = (bitlenHi >>> 8) & 0xff;
    padded[off + 3] = bitlenHi & 0xff;
    padded[off + 4] = (bitlenLo >>> 24) & 0xff;
    padded[off + 5] = (bitlenLo >>> 16) & 0xff;
    padded[off + 6] = (bitlenLo >>> 8) & 0xff;
    padded[off + 7] = bitlenLo & 0xff;

    var h = H0.slice();
    var w = new Array(64);
    for (var blk = 0; blk < padded.length; blk += 64) {
      for (var j = 0; j < 16; j++) {
        var b = blk + j * 4;
        w[j] = (padded[b] << 24) | (padded[b + 1] << 16) | (padded[b + 2] << 8) | padded[b + 3];
      }
      for (j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      var a = h[0], b2 = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[j] + w[j]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b2) ^ (a & c) ^ (b2 & c);
        var t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b2) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var hex = "";
    for (i = 0; i < 8; i++) hex += ("00000000" + h[i].toString(16)).slice(-8);
    return hex;
  }

  root.sha256Hex = sha256Hex;
})(window);