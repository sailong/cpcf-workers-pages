let m, h, y, O, B, R, C, k, oe;
let __tla = (async () => {
  const F = "/assets/mail_parser_wasm_bg-BA0AUcSW.wasm", W = async (n = {}, e) => {
    let t;
    if (e.startsWith("data:")) {
      const r = e.replace(/^data:.*?base64,/, "");
      let a;
      if (typeof Buffer == "function" && typeof Buffer.from == "function") a = Buffer.from(r, "base64");
      else if (typeof atob == "function") {
        const l = atob(r);
        a = new Uint8Array(l.length);
        for (let i = 0; i < l.length; i++) a[i] = l.charCodeAt(i);
      } else throw new Error("Cannot decode base64-encoded data URL");
      t = await WebAssembly.instantiate(a, n);
    } else {
      const r = await fetch(e), a = r.headers.get("Content-Type") || "";
      if ("instantiateStreaming" in WebAssembly && a.startsWith("application/wasm")) t = await WebAssembly.instantiateStreaming(r, n);
      else {
        const l = await r.arrayBuffer();
        t = await WebAssembly.instantiate(l, n);
      }
    }
    return t.instance.exports;
  };
  let _;
  R = function(n) {
    _ = n;
  };
  const U = typeof TextDecoder > "u" ? (0, module.require)("util").TextDecoder : TextDecoder;
  let v = new U("utf-8", {
    ignoreBOM: true,
    fatal: true
  });
  v.decode();
  let f = null;
  function u() {
    return (f === null || f.byteLength === 0) && (f = new Uint8Array(_.memory.buffer)), f;
  }
  function o(n, e) {
    return n = n >>> 0, v.decode(u().subarray(n, n + e));
  }
  function z(n, e) {
    return n = n >>> 0, u().subarray(n / 1, n / 1 + e);
  }
  let d = null;
  function M() {
    return (d === null || d.buffer.detached === true || d.buffer.detached === void 0 && d.buffer !== _.memory.buffer) && (d = new DataView(_.memory.buffer)), d;
  }
  function p(n, e) {
    n = n >>> 0;
    const t = M(), r = [];
    for (let a = n; a < n + 4 * e; a += 4) r.push(_.__wbindgen_export_0.get(t.getUint32(a, true)));
    return _.__externref_drop_slice(n, e), r;
  }
  let w = 0;
  const S = typeof TextEncoder > "u" ? (0, module.require)("util").TextEncoder : TextEncoder;
  let b = new S("utf-8");
  const E = typeof b.encodeInto == "function" ? function(n, e) {
    return b.encodeInto(n, e);
  } : function(n, e) {
    const t = b.encode(n);
    return e.set(t), {
      read: n.length,
      written: t.length
    };
  };
  function D(n, e, t) {
    if (t === void 0) {
      const c = b.encode(n), g = e(c.length, 1) >>> 0;
      return u().subarray(g, g + c.length).set(c), w = c.length, g;
    }
    let r = n.length, a = e(r, 1) >>> 0;
    const l = u();
    let i = 0;
    for (; i < r; i++) {
      const c = n.charCodeAt(i);
      if (c > 127) break;
      l[a + i] = c;
    }
    if (i !== r) {
      i !== 0 && (n = n.slice(i)), a = t(a, r, r = i + n.length * 3, 1) >>> 0;
      const c = u().subarray(a + i, a + r), g = E(n, c);
      i += g.written, a = t(a, r, i, 1) >>> 0;
    }
    return w = i, a;
  }
  oe = function(n) {
    const e = D(n, _.__wbindgen_malloc, _.__wbindgen_realloc), t = w, r = _.parse_message(e, t);
    return y.__wrap(r);
  };
  const x = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((n) => _.__wbg_attachmentresult_free(n >>> 0, 1));
  m = class {
    static __wrap(e) {
      e = e >>> 0;
      const t = Object.create(m.prototype);
      return t.__wbg_ptr = e, x.register(t, t.__wbg_ptr, t), t;
    }
    __destroy_into_raw() {
      const e = this.__wbg_ptr;
      return this.__wbg_ptr = 0, x.unregister(this), e;
    }
    free() {
      const e = this.__destroy_into_raw();
      _.__wbg_attachmentresult_free(e, 0);
    }
    get content_id() {
      let e, t;
      try {
        const r = _.attachmentresult_content_id(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get content_type() {
      let e, t;
      try {
        const r = _.attachmentresult_content_type(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get filename() {
      let e, t;
      try {
        const r = _.attachmentresult_filename(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get content() {
      const e = _.attachmentresult_content(this.__wbg_ptr);
      var t = z(e[0], e[1]).slice();
      return _.__wbindgen_free(e[0], e[1] * 1, 1), t;
    }
  };
  const A = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((n) => _.__wbg_messageheader_free(n >>> 0, 1));
  h = class {
    static __wrap(e) {
      e = e >>> 0;
      const t = Object.create(h.prototype);
      return t.__wbg_ptr = e, A.register(t, t.__wbg_ptr, t), t;
    }
    __destroy_into_raw() {
      const e = this.__wbg_ptr;
      return this.__wbg_ptr = 0, A.unregister(this), e;
    }
    free() {
      const e = this.__destroy_into_raw();
      _.__wbg_messageheader_free(e, 0);
    }
    get key() {
      let e, t;
      try {
        const r = _.messageheader_key(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get value() {
      let e, t;
      try {
        const r = _.messageheader_value(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
  };
  const T = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((n) => _.__wbg_messageresult_free(n >>> 0, 1));
  y = class {
    static __wrap(e) {
      e = e >>> 0;
      const t = Object.create(y.prototype);
      return t.__wbg_ptr = e, T.register(t, t.__wbg_ptr, t), t;
    }
    __destroy_into_raw() {
      const e = this.__wbg_ptr;
      return this.__wbg_ptr = 0, T.unregister(this), e;
    }
    free() {
      const e = this.__destroy_into_raw();
      _.__wbg_messageresult_free(e, 0);
    }
    get sender() {
      let e, t;
      try {
        const r = _.messageresult_sender(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get subject() {
      let e, t;
      try {
        const r = _.messageresult_subject(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get headers() {
      const e = _.messageresult_headers(this.__wbg_ptr);
      var t = p(e[0], e[1]).slice();
      return _.__wbindgen_free(e[0], e[1] * 4, 4), t;
    }
    get body_html() {
      let e, t;
      try {
        const r = _.messageresult_body_html(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get text() {
      let e, t;
      try {
        const r = _.messageresult_text(this.__wbg_ptr);
        return e = r[0], t = r[1], o(r[0], r[1]);
      } finally {
        _.__wbindgen_free(e, t, 1);
      }
    }
    get attachments() {
      const e = _.messageresult_attachments(this.__wbg_ptr);
      var t = p(e[0], e[1]).slice();
      return _.__wbindgen_free(e[0], e[1] * 4, 4), t;
    }
  };
  O = function(n) {
    return m.__wrap(n);
  };
  B = function(n) {
    return h.__wrap(n);
  };
  C = function() {
    const n = _.__wbindgen_export_0, e = n.grow(4);
    n.set(0, void 0), n.set(e + 0, void 0), n.set(e + 1, null), n.set(e + 2, true), n.set(e + 3, false);
  };
  k = function(n, e) {
    throw new Error(o(n, e));
  };
  URL = globalThis.URL;
  const s = await W({
    "./mail_parser_wasm_bg.js": {
      __wbg_attachmentresult_new: O,
      __wbg_messageheader_new: B,
      __wbindgen_throw: k,
      __wbindgen_init_externref_table: C
    }
  }, F), L = s.memory, V = s.__wbg_attachmentresult_free, q = s.attachmentresult_content_id, I = s.attachmentresult_content_type, $ = s.attachmentresult_filename, H = s.attachmentresult_content, J = s.__wbg_messageheader_free, N = s.messageheader_key, P = s.messageheader_value, G = s.__wbg_messageresult_free, K = s.messageresult_sender, Q = s.messageresult_subject, X = s.messageresult_headers, Y = s.messageresult_body_html, Z = s.messageresult_text, ee = s.messageresult_attachments, te = s.parse_message, re = s.__wbindgen_export_0, ne = s.__wbindgen_free, _e = s.__externref_drop_slice, se = s.__wbindgen_malloc, ae = s.__wbindgen_realloc, j = s.__wbindgen_start, ie = Object.freeze(Object.defineProperty({
    __proto__: null,
    __externref_drop_slice: _e,
    __wbg_attachmentresult_free: V,
    __wbg_messageheader_free: J,
    __wbg_messageresult_free: G,
    __wbindgen_export_0: re,
    __wbindgen_free: ne,
    __wbindgen_malloc: se,
    __wbindgen_realloc: ae,
    __wbindgen_start: j,
    attachmentresult_content: H,
    attachmentresult_content_id: q,
    attachmentresult_content_type: I,
    attachmentresult_filename: $,
    memory: L,
    messageheader_key: N,
    messageheader_value: P,
    messageresult_attachments: ee,
    messageresult_body_html: Y,
    messageresult_headers: X,
    messageresult_sender: K,
    messageresult_subject: Q,
    messageresult_text: Z,
    parse_message: te
  }, Symbol.toStringTag, {
    value: "Module"
  }));
  R(ie);
  j();
})();
export {
  m as AttachmentResult,
  h as MessageHeader,
  y as MessageResult,
  __tla,
  O as __wbg_attachmentresult_new,
  B as __wbg_messageheader_new,
  R as __wbg_set_wasm,
  C as __wbindgen_init_externref_table,
  k as __wbindgen_throw,
  oe as parse_message
};
