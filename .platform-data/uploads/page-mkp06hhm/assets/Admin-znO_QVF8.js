const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/SendMail-tmYt0zPe.js","assets/index.esm-Bna_jRUN.js","assets/index-ex9E0DB9.js","assets/index-CsMpOl-6.css","assets/index-BHtaHxM4.css","assets/SendMail-aMwcx0sS.css"])))=>i.map(i=>d[i]);
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { d as re, h as L, c as zt, i as Nt, b as qt, a as Vt, e as Ft, f as Oe, _ as de, r as ze, u as St, g as Xe, j as jt, k as Wt, l as f, m as Ht, n as Me, w as Ye, o as Lt, p as ke, q as dt, N as ct, X as pt, A as Kt, s as Be, t as Gt, v as mt, x as Jt, y as Qt, z as Qe, B as Xt, C as Yt, D as J, E as R, F as M, G as Z, H as ie, I as te, J as ee, K as O, L as Ze, M as P, O as ae, P as e, Q as t, R as o, S as a, T as Ut, U as Ke, V as _, W as Pe, Y as Ge, Z as xe, $ as st, a0 as Ne, a1 as Zt, a2 as ea, a3 as It, a4 as _t, a5 as ue, a6 as ot, a7 as ta, a8 as He, a9 as Mt, aa as Tt, ab as X, ac as le, ad as rt, ae as qe, af as aa, ag as Pt, ah as Dt, ai as ge, aj as Ve, ak as la, al as se, am as Et, an as ft, ao as Se, ap as De, aq as Le, ar as it, as as et, at as vt, au as na, av as ut, aw as $t, ax as Rt, ay as Bt, az as Ot, aA as sa, aB as oa, aC as ra, aD as ia, aE as ua, aF as da, aG as ca, aH as pa, __tla as __tla_0 } from "./index-ex9E0DB9.js";
let Gl;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })()
]).then(async () => {
  const ma = re({
    name: "Remove",
    render() {
      return L("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 512 512"
      }, L("line", {
        x1: "400",
        y1: "256",
        x2: "112",
        y2: "256",
        style: `
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 32px;
      `
      }));
    }
  });
  function _a(m) {
    const { textColorDisabled: d } = m;
    return {
      iconColorDisabled: d
    };
  }
  const fa = zt({
    name: "InputNumber",
    common: Vt,
    peers: {
      Button: qt,
      Input: Nt
    },
    self: _a
  }), va = Ft([
    Oe("input-number-suffix", `
 display: inline-block;
 margin-right: 10px;
 `),
    Oe("input-number-prefix", `
 display: inline-block;
 margin-left: 10px;
 `)
  ]);
  function ba(m) {
    return m == null || typeof m == "string" && m.trim() === "" ? null : Number(m);
  }
  function ga(m) {
    return m.includes(".") && (/^(-)?\d+.*(\.|0)$/.test(m) || /^-?\d*$/.test(m)) || m === "-" || m === "-0";
  }
  function lt(m) {
    return m == null ? true : !Number.isNaN(m);
  }
  function bt(m, d) {
    return typeof m != "number" ? "" : d === void 0 ? String(m) : m.toFixed(d);
  }
  function nt(m) {
    if (m === null) return null;
    if (typeof m == "number") return m;
    {
      const d = Number(m);
      return Number.isNaN(d) ? null : d;
    }
  }
  let gt, ht, ha, Je, ya, wa, ka, xa, Aa, Ca, Te, Sa, La, Ua, Ia, Ma, Ta, Pa, yt, Da, Ea, $a, Ra, Ba, Oa, za, Na, qa, Va, Fa, ja, Wa, Ha, Ka, Ga, Ja, Qa, Xa, Ya, wt, Za, el, tl, al, ll, nl, sl, ol, rl, il, kt, ul, xt, dl, cl, pl, ml, _l, fl, vl, bl, gl, hl, yl, wl, kl, xl, Al, Cl, At, Sl, Ll, Ul, Il, Ml, Tl, Pl, Dl, El, $l, Ct, Rl, Bl, Ol, zl, Nl, ql, Vl, Fl, jl, Wl, Hl;
  gt = 800;
  ht = 100;
  ha = Object.assign(Object.assign({}, Xe.props), {
    autofocus: Boolean,
    loading: {
      type: Boolean,
      default: void 0
    },
    placeholder: String,
    defaultValue: {
      type: Number,
      default: null
    },
    value: Number,
    step: {
      type: [
        Number,
        String
      ],
      default: 1
    },
    min: [
      Number,
      String
    ],
    max: [
      Number,
      String
    ],
    size: String,
    disabled: {
      type: Boolean,
      default: void 0
    },
    validator: Function,
    bordered: {
      type: Boolean,
      default: void 0
    },
    showButton: {
      type: Boolean,
      default: true
    },
    buttonPlacement: {
      type: String,
      default: "right"
    },
    inputProps: Object,
    readonly: Boolean,
    clearable: Boolean,
    keyboard: {
      type: Object,
      default: {}
    },
    updateValueOnInput: {
      type: Boolean,
      default: true
    },
    round: {
      type: Boolean,
      default: void 0
    },
    parse: Function,
    format: Function,
    precision: Number,
    status: String,
    "onUpdate:value": [
      Function,
      Array
    ],
    onUpdateValue: [
      Function,
      Array
    ],
    onFocus: [
      Function,
      Array
    ],
    onBlur: [
      Function,
      Array
    ],
    onClear: [
      Function,
      Array
    ],
    onChange: [
      Function,
      Array
    ]
  });
  Je = re({
    name: "InputNumber",
    props: ha,
    slots: Object,
    setup(m) {
      const { mergedBorderedRef: d, mergedClsPrefixRef: r, mergedRtlRef: l } = St(m), n = Xe("InputNumber", "-input-number", va, fa, m, r), { localeRef: v } = jt("InputNumber"), p = Wt(m), { mergedSizeRef: s, mergedDisabledRef: b, mergedStatusRef: y } = p, i = f(null), c = f(null), x = f(null), w = f(m.defaultValue), U = Jt(m, "value"), u = Ht(U, w), g = f(""), A = (h) => {
        const q = String(h).split(".")[1];
        return q ? q.length : 0;
      }, z = (h) => {
        const q = [
          m.min,
          m.max,
          m.step,
          h
        ].map((K) => K === void 0 ? 0 : A(K));
        return Math.max(...q);
      }, j = Me(() => {
        const { placeholder: h } = m;
        return h !== void 0 ? h : v.value.placeholder;
      }), T = Me(() => {
        const h = nt(m.step);
        return h !== null ? h === 0 ? 1 : Math.abs(h) : 1;
      }), S = Me(() => {
        const h = nt(m.min);
        return h !== null ? h : null;
      }), I = Me(() => {
        const h = nt(m.max);
        return h !== null ? h : null;
      }), F = () => {
        const { value: h } = u;
        if (lt(h)) {
          const { format: q, precision: K } = m;
          q ? g.value = q(h) : h === null || K === void 0 || A(h) > K ? g.value = bt(h, void 0) : g.value = bt(h, K);
        } else g.value = String(h);
      };
      F();
      const W = (h) => {
        const { value: q } = u;
        if (h === q) {
          F();
          return;
        }
        const { "onUpdate:value": K, onUpdateValue: V, onChange: be } = m, { nTriggerFormInput: we, nTriggerFormChange: Re } = p;
        be && Be(be, h), V && Be(V, h), K && Be(K, h), w.value = h, we(), Re();
      }, k = ({ offset: h, doUpdateIfValid: q, fixPrecision: K, isInputing: V }) => {
        const { value: be } = g;
        if (V && ga(be)) return false;
        const we = (m.parse || ba)(be);
        if (we === null) return q && W(null), null;
        if (lt(we)) {
          const Re = A(we), { precision: We } = m;
          if (We !== void 0 && We < Re && !K) return false;
          let Ce = Number.parseFloat((we + h).toFixed(We ?? z(we)));
          if (lt(Ce)) {
            const { value: tt } = I, { value: at } = S;
            if (tt !== null && Ce > tt) {
              if (!q || V) return false;
              Ce = tt;
            }
            if (at !== null && Ce < at) {
              if (!q || V) return false;
              Ce = at;
            }
            return m.validator && !m.validator(Ce) ? false : (q && W(Ce), Ce);
          }
        }
        return false;
      }, $ = Me(() => k({
        offset: 0,
        doUpdateIfValid: false,
        isInputing: false,
        fixPrecision: false
      }) === false), B = Me(() => {
        const { value: h } = u;
        if (m.validator && h === null) return false;
        const { value: q } = T;
        return k({
          offset: -q,
          doUpdateIfValid: false,
          isInputing: false,
          fixPrecision: false
        }) !== false;
      }), Y = Me(() => {
        const { value: h } = u;
        if (m.validator && h === null) return false;
        const { value: q } = T;
        return k({
          offset: +q,
          doUpdateIfValid: false,
          isInputing: false,
          fixPrecision: false
        }) !== false;
      });
      function oe(h) {
        const { onFocus: q } = m, { nTriggerFormFocus: K } = p;
        q && Be(q, h), K();
      }
      function ce(h) {
        var q, K;
        if (h.target === ((q = i.value) === null || q === void 0 ? void 0 : q.wrapperElRef)) return;
        const V = k({
          offset: 0,
          doUpdateIfValid: true,
          isInputing: false,
          fixPrecision: true
        });
        if (V !== false) {
          const Re = (K = i.value) === null || K === void 0 ? void 0 : K.inputElRef;
          Re && (Re.value = String(V || "")), u.value === V && F();
        } else F();
        const { onBlur: be } = m, { nTriggerFormBlur: we } = p;
        be && Be(be, h), we(), Gt(() => {
          F();
        });
      }
      function C(h) {
        const { onClear: q } = m;
        q && Be(q, h);
      }
      function E() {
        const { value: h } = Y;
        if (!h) {
          H();
          return;
        }
        const { value: q } = u;
        if (q === null) m.validator || W(me());
        else {
          const { value: K } = T;
          k({
            offset: K,
            doUpdateIfValid: true,
            isInputing: false,
            fixPrecision: true
          });
        }
      }
      function N() {
        const { value: h } = B;
        if (!h) {
          G();
          return;
        }
        const { value: q } = u;
        if (q === null) m.validator || W(me());
        else {
          const { value: K } = T;
          k({
            offset: -K,
            doUpdateIfValid: true,
            isInputing: false,
            fixPrecision: true
          });
        }
      }
      const pe = oe, Q = ce;
      function me() {
        if (m.validator) return null;
        const { value: h } = S, { value: q } = I;
        return h !== null ? Math.max(0, h) : q !== null ? Math.min(0, q) : 0;
      }
      function Ue(h) {
        C(h), W(null);
      }
      function Fe(h) {
        var q, K, V;
        !((q = x.value) === null || q === void 0) && q.$el.contains(h.target) && h.preventDefault(), !((K = c.value) === null || K === void 0) && K.$el.contains(h.target) && h.preventDefault(), (V = i.value) === null || V === void 0 || V.activate();
      }
      let he = null, ye = null, ne = null;
      function G() {
        ne && (window.clearTimeout(ne), ne = null), he && (window.clearInterval(he), he = null);
      }
      let D = null;
      function H() {
        D && (window.clearTimeout(D), D = null), ye && (window.clearInterval(ye), ye = null);
      }
      function je() {
        G(), ne = window.setTimeout(() => {
          he = window.setInterval(() => {
            N();
          }, ht);
        }, gt), mt("mouseup", document, G, {
          once: true
        });
      }
      function _e() {
        H(), D = window.setTimeout(() => {
          ye = window.setInterval(() => {
            E();
          }, ht);
        }, gt), mt("mouseup", document, H, {
          once: true
        });
      }
      const fe = () => {
        ye || E();
      }, Ee = () => {
        he || N();
      };
      function Ie(h) {
        var q, K;
        if (h.key === "Enter") {
          if (h.target === ((q = i.value) === null || q === void 0 ? void 0 : q.wrapperElRef)) return;
          k({
            offset: 0,
            doUpdateIfValid: true,
            isInputing: false,
            fixPrecision: true
          }) !== false && ((K = i.value) === null || K === void 0 || K.deactivate());
        } else if (h.key === "ArrowUp") {
          if (!Y.value || m.keyboard.ArrowUp === false) return;
          h.preventDefault(), k({
            offset: 0,
            doUpdateIfValid: true,
            isInputing: false,
            fixPrecision: true
          }) !== false && E();
        } else if (h.key === "ArrowDown") {
          if (!B.value || m.keyboard.ArrowDown === false) return;
          h.preventDefault(), k({
            offset: 0,
            doUpdateIfValid: true,
            isInputing: false,
            fixPrecision: true
          }) !== false && N();
        }
      }
      function ve(h) {
        g.value = h, m.updateValueOnInput && !m.format && !m.parse && m.precision === void 0 && k({
          offset: 0,
          doUpdateIfValid: true,
          isInputing: true,
          fixPrecision: false
        });
      }
      Ye(u, () => {
        F();
      });
      const Ae = {
        focus: () => {
          var h;
          return (h = i.value) === null || h === void 0 ? void 0 : h.focus();
        },
        blur: () => {
          var h;
          return (h = i.value) === null || h === void 0 ? void 0 : h.blur();
        },
        select: () => {
          var h;
          return (h = i.value) === null || h === void 0 ? void 0 : h.select();
        }
      }, $e = Lt("InputNumber", l, r);
      return Object.assign(Object.assign({}, Ae), {
        rtlEnabled: $e,
        inputInstRef: i,
        minusButtonInstRef: c,
        addButtonInstRef: x,
        mergedClsPrefix: r,
        mergedBordered: d,
        uncontrolledValue: w,
        mergedValue: u,
        mergedPlaceholder: j,
        displayedValueInvalid: $,
        mergedSize: s,
        mergedDisabled: b,
        displayedValue: g,
        addable: Y,
        minusable: B,
        mergedStatus: y,
        handleFocus: pe,
        handleBlur: Q,
        handleClear: Ue,
        handleMouseDown: Fe,
        handleAddClick: fe,
        handleMinusClick: Ee,
        handleAddMousedown: _e,
        handleMinusMousedown: je,
        handleKeyDown: Ie,
        handleUpdateDisplayedValue: ve,
        mergedTheme: n,
        inputThemeOverrides: {
          paddingSmall: "0 8px 0 10px",
          paddingMedium: "0 8px 0 12px",
          paddingLarge: "0 8px 0 14px"
        },
        buttonThemeOverrides: ke(() => {
          const { self: { iconColorDisabled: h } } = n.value, [q, K, V, be] = Qt(h);
          return {
            textColorTextDisabled: `rgb(${q}, ${K}, ${V})`,
            opacityDisabled: `${be}`
          };
        })
      });
    },
    render() {
      const { mergedClsPrefix: m, $slots: d } = this, r = () => L(pt, {
        text: true,
        disabled: !this.minusable || this.mergedDisabled || this.readonly,
        focusable: false,
        theme: this.mergedTheme.peers.Button,
        themeOverrides: this.mergedTheme.peerOverrides.Button,
        builtinThemeOverrides: this.buttonThemeOverrides,
        onClick: this.handleMinusClick,
        onMousedown: this.handleMinusMousedown,
        ref: "minusButtonInstRef"
      }, {
        icon: () => dt(d["minus-icon"], () => [
          L(ct, {
            clsPrefix: m
          }, {
            default: () => L(ma, null)
          })
        ])
      }), l = () => L(pt, {
        text: true,
        disabled: !this.addable || this.mergedDisabled || this.readonly,
        focusable: false,
        theme: this.mergedTheme.peers.Button,
        themeOverrides: this.mergedTheme.peerOverrides.Button,
        builtinThemeOverrides: this.buttonThemeOverrides,
        onClick: this.handleAddClick,
        onMousedown: this.handleAddMousedown,
        ref: "addButtonInstRef"
      }, {
        icon: () => dt(d["add-icon"], () => [
          L(ct, {
            clsPrefix: m
          }, {
            default: () => L(Kt, null)
          })
        ])
      });
      return L("div", {
        class: [
          `${m}-input-number`,
          this.rtlEnabled && `${m}-input-number--rtl`
        ]
      }, L(de, {
        ref: "inputInstRef",
        autofocus: this.autofocus,
        status: this.mergedStatus,
        bordered: this.mergedBordered,
        loading: this.loading,
        value: this.displayedValue,
        onUpdateValue: this.handleUpdateDisplayedValue,
        theme: this.mergedTheme.peers.Input,
        themeOverrides: this.mergedTheme.peerOverrides.Input,
        builtinThemeOverrides: this.inputThemeOverrides,
        size: this.mergedSize,
        placeholder: this.mergedPlaceholder,
        disabled: this.mergedDisabled,
        readonly: this.readonly,
        round: this.round,
        textDecoration: this.displayedValueInvalid ? "line-through" : void 0,
        onFocus: this.handleFocus,
        onBlur: this.handleBlur,
        onKeydown: this.handleKeyDown,
        onMousedown: this.handleMouseDown,
        onClear: this.handleClear,
        clearable: this.clearable,
        inputProps: this.inputProps,
        internalLoadingBeforeSuffix: true
      }, {
        prefix: () => {
          var n;
          return this.showButton && this.buttonPlacement === "both" ? [
            r(),
            ze(d.prefix, (v) => v ? L("span", {
              class: `${m}-input-number-prefix`
            }, v) : null)
          ] : (n = d.prefix) === null || n === void 0 ? void 0 : n.call(d);
        },
        suffix: () => {
          var n;
          return this.showButton ? [
            ze(d.suffix, (v) => v ? L("span", {
              class: `${m}-input-number-suffix`
            }, v) : null),
            this.buttonPlacement === "right" ? r() : null,
            l()
          ] : (n = d.suffix) === null || n === void 0 ? void 0 : n.call(d);
        }
      }));
    }
  });
  ya = Oe("statistic", [
    Qe("label", `
 font-weight: var(--n-label-font-weight);
 transition: .3s color var(--n-bezier);
 font-size: var(--n-label-font-size);
 color: var(--n-label-text-color);
 `),
    Oe("statistic-value", `
 margin-top: 4px;
 font-weight: var(--n-value-font-weight);
 `, [
      Qe("prefix", `
 margin: 0 4px 0 0;
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-prefix-text-color);
 `, [
        Oe("icon", {
          verticalAlign: "-0.125em"
        })
      ]),
      Qe("content", `
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-text-color);
 `),
      Qe("suffix", `
 margin: 0 0 0 4px;
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-suffix-text-color);
 `, [
        Oe("icon", {
          verticalAlign: "-0.125em"
        })
      ])
    ])
  ]);
  wa = Object.assign(Object.assign({}, Xe.props), {
    tabularNums: Boolean,
    label: String,
    value: [
      String,
      Number
    ]
  });
  ka = re({
    name: "Statistic",
    props: wa,
    slots: Object,
    setup(m) {
      const { mergedClsPrefixRef: d, inlineThemeDisabled: r, mergedRtlRef: l } = St(m), n = Xe("Statistic", "-statistic", ya, Xt, m, d), v = Lt("Statistic", l, d), p = ke(() => {
        const { self: { labelFontWeight: b, valueFontSize: y, valueFontWeight: i, valuePrefixTextColor: c, labelTextColor: x, valueSuffixTextColor: w, valueTextColor: U, labelFontSize: u }, common: { cubicBezierEaseInOut: g } } = n.value;
        return {
          "--n-bezier": g,
          "--n-label-font-size": u,
          "--n-label-font-weight": b,
          "--n-label-text-color": x,
          "--n-value-font-weight": i,
          "--n-value-font-size": y,
          "--n-value-prefix-text-color": c,
          "--n-value-suffix-text-color": w,
          "--n-value-text-color": U
        };
      }), s = r ? Yt("statistic", void 0, p, m) : void 0;
      return {
        rtlEnabled: v,
        mergedClsPrefix: d,
        cssVars: r ? void 0 : p,
        themeClass: s == null ? void 0 : s.themeClass,
        onRender: s == null ? void 0 : s.onRender
      };
    },
    render() {
      var m;
      const { mergedClsPrefix: d, $slots: { default: r, label: l, prefix: n, suffix: v } } = this;
      return (m = this.onRender) === null || m === void 0 || m.call(this), L("div", {
        class: [
          `${d}-statistic`,
          this.themeClass,
          this.rtlEnabled && `${d}-statistic--rtl`
        ],
        style: this.cssVars
      }, ze(l, (p) => L("div", {
        class: `${d}-statistic__label`
      }, this.label || p)), L("div", {
        class: `${d}-statistic-value`,
        style: {
          fontVariantNumeric: this.tabularNums ? "tabular-nums" : ""
        }
      }, ze(n, (p) => p && L("span", {
        class: `${d}-statistic-value__prefix`
      }, p)), this.value !== void 0 ? L("span", {
        class: `${d}-statistic-value__content`
      }, this.value) : ze(r, (p) => p && L("span", {
        class: `${d}-statistic-value__content`
      }, p)), ze(v, (p) => p && L("span", {
        class: `${d}-statistic-value__suffix`
      }, p))));
    }
  });
  xa = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  Aa = re({
    name: "AddFilled",
    render: function(d, r) {
      return R(), J("svg", xa, r[0] || (r[0] = [
        M("path", {
          d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Ca = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  Te = re({
    name: "CleaningServicesFilled",
    render: function(d, r) {
      return R(), J("svg", Ca, r[0] || (r[0] = [
        M("path", {
          d: "M16 11h-1V3c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v8H8c-2.76 0-5 2.24-5 5v7h18v-7c0-2.76-2.24-5-5-5zm3 10h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H9v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H5v-5c0-1.65 1.35-3 3-3h8c1.65 0 3 1.35 3 3v5z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Sa = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  La = re({
    name: "DeleteFilled",
    render: function(d, r) {
      return R(), J("svg", Sa, r[0] || (r[0] = [
        M("path", {
          d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Ua = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  Ia = re({
    name: "SendOutlined",
    render: function(d, r) {
      return R(), J("svg", Ua, r[0] || (r[0] = [
        M("path", {
          d: "M4.01 6.03l7.51 3.22l-7.52-1l.01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2l-15 2l.01 7L23 12L2.01 3z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Ma = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 576 512"
  };
  Ta = re({
    name: "MailBulk",
    render: function(d, r) {
      return R(), J("svg", Ma, r[0] || (r[0] = [
        M("path", {
          d: "M160 448c-25.6 0-51.2-22.4-64-32c-64-44.8-83.2-60.8-96-70.4V480c0 17.67 14.33 32 32 32h256c17.67 0 32-14.33 32-32V345.6c-12.8 9.6-32 25.6-96 70.4c-12.8 9.6-38.4 32-64 32zm128-192H32c-17.67 0-32 14.33-32 32v16c25.6 19.2 22.4 19.2 115.2 86.4c9.6 6.4 28.8 25.6 44.8 25.6s35.2-19.2 44.8-22.4c92.8-67.2 89.6-67.2 115.2-86.4V288c0-17.67-14.33-32-32-32zm256-96H224c-17.67 0-32 14.33-32 32v32h96c33.21 0 60.59 25.42 63.71 57.82l.29-.22V416h192c17.67 0 32-14.33 32-32V192c0-17.67-14.33-32-32-32zm-32 128h-64v-64h64v64zm-352-96c0-35.29 28.71-64 64-64h224V32c0-17.67-14.33-32-32-32H96C78.33 0 64 14.33 64 32v192h96v-32z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Pa = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 640 512"
  };
  yt = re({
    name: "UserCheck",
    render: function(d, r) {
      return R(), J("svg", Pa, r[0] || (r[0] = [
        M("path", {
          d: "M224 256c70.7 0 128-57.3 128-128S294.7 0 224 0S96 57.3 96 128s57.3 128 128 128zm89.6 32h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-41.6c0-74.2-60.2-134.4-134.4-134.4zm323-128.4l-27.8-28.1c-4.6-4.7-12.1-4.7-16.8-.1l-104.8 104l-45.5-45.8c-4.6-4.7-12.1-4.7-16.8-.1l-28.1 27.9c-4.7 4.6-4.7 12.1-.1 16.8l81.7 82.3c4.6 4.7 12.1 4.7 16.8.1l141.3-140.2c4.6-4.7 4.7-12.2.1-16.8z",
          fill: "currentColor"
        }, null, -1)
      ]));
    }
  });
  Da = {
    style: {
      overflow: "auto"
    }
  };
  Ea = {
    style: {
      display: "inline-block"
    }
  };
  $a = {
    __name: "SenderAccess",
    setup(m) {
      const { loading: d } = ie(), r = te(), { t: l } = ee({
        messages: {
          en: {
            address: "Address",
            success: "Success",
            is_enabled: "Is Enabled",
            enable: "Enable",
            disable: "Disable",
            modify: "Modify",
            delete: "Delete",
            deleteTip: "Are you sure to delete this?",
            created_at: "Created At",
            action: "Action",
            itemCount: "itemCount",
            modalTip: "Please input the sender balance",
            balance: "Balance",
            query: "Query",
            ok: "OK"
          },
          zh: {
            address: "\u5730\u5740",
            success: "\u6210\u529F",
            is_enabled: "\u662F\u5426\u542F\u7528",
            enable: "\u542F\u7528",
            disable: "\u7981\u7528",
            modify: "\u4FEE\u6539",
            delete: "\u5220\u9664",
            deleteTip: "\u786E\u5B9A\u5220\u9664\u5417\uFF1F",
            created_at: "\u521B\u5EFA\u65F6\u95F4",
            action: "\u64CD\u4F5C",
            itemCount: "\u603B\u6570",
            modalTip: "\u8BF7\u8F93\u5165\u53D1\u4EF6\u989D\u5EA6",
            balance: "\u4F59\u989D",
            query: "\u67E5\u8BE2",
            ok: "\u786E\u5B9A"
          }
        }
      }), n = f([]), v = f(0), p = f(1), s = f(20), b = f({}), y = f(false), i = f(0), c = f(false), x = f(""), w = async () => {
        try {
          await P.fetch("/admin/address_sender", {
            method: "POST",
            body: JSON.stringify({
              address: b.value.address,
              address_id: b.value.id,
              balance: i.value,
              enabled: c.value ? 1 : 0
            })
          }), y.value = false, r.success(l("success")), await U();
        } catch (g) {
          r.error(g.message || "error");
        }
      }, U = async () => {
        try {
          x.value = x.value.trim();
          const { results: g, count: A } = await P.fetch(`/admin/address_sender?limit=${s.value}&offset=${(p.value - 1) * s.value}` + (x.value ? `&address=${x.value}` : ""));
          n.value = g, A > 0 && (v.value = A);
        } catch (g) {
          console.log(g), r.error(g.message || "error");
        }
      }, u = [
        {
          title: "ID",
          key: "id"
        },
        {
          title: l("address"),
          key: "address"
        },
        {
          title: l("created_at"),
          key: "created_at"
        },
        {
          title: l("balance"),
          key: "balance"
        },
        {
          title: l("is_enabled"),
          key: "enabled",
          render(g) {
            return L("div", [
              L("span", g.enabled ? l("enable") : l("disable"))
            ]);
          }
        },
        {
          title: l("action"),
          key: "actions",
          render(g) {
            return L("div", [
              L(O, {
                type: "success",
                tertiary: true,
                onClick: () => {
                  y.value = true, b.value = g, c.value = !!g.enabled, i.value = g.balance;
                }
              }, {
                default: () => l("modify")
              }),
              L(Ze, {
                onPositiveClick: async () => {
                  await P.fetch(`/admin/address_sender/${g.id}`, {
                    method: "DELETE"
                  }), await U();
                }
              }, {
                trigger: () => L(O, {
                  tertiary: true,
                  type: "error"
                }, {
                  default: () => l("delete")
                }),
                default: () => l("deleteTip")
              })
            ]);
          }
        }
      ];
      return Ye([
        p,
        s
      ], async () => {
        await U();
      }), ae(async () => {
        await U();
      }), (g, A) => {
        const z = Ke, j = Ut, T = Je, S = O, I = Pe, F = de, W = xe, k = st, $ = Ne;
        return R(), J("div", null, [
          e(I, {
            show: y.value,
            "onUpdate:show": A[3] || (A[3] = (B) => y.value = B),
            preset: "dialog"
          }, {
            action: t(() => [
              e(S, {
                loading: a(d),
                onClick: A[2] || (A[2] = (B) => w()),
                size: "small",
                tertiary: "",
                type: "primary"
              }, {
                default: t(() => [
                  _(o(a(l)("ok")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(b.value.address), 1),
              M("p", null, o(a(l)("modalTip")), 1),
              e(j, {
                "show-label": false
              }, {
                default: t(() => [
                  e(z, {
                    checked: c.value,
                    "onUpdate:checked": A[0] || (A[0] = (B) => c.value = B)
                  }, {
                    default: t(() => [
                      _(o(a(l)("enable")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "checked"
                  ])
                ]),
                _: 1
              }),
              e(j, {
                "show-label": false
              }, {
                default: t(() => [
                  e(T, {
                    value: i.value,
                    "onUpdate:value": A[1] || (A[1] = (B) => i.value = B),
                    min: 0,
                    max: 1e3
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show"
          ]),
          e(W, null, {
            default: t(() => [
              e(F, {
                value: x.value,
                "onUpdate:value": A[4] || (A[4] = (B) => x.value = B),
                onKeydown: Ge(U, [
                  "enter"
                ])
              }, null, 8, [
                "value"
              ]),
              e(S, {
                onClick: U,
                type: "primary",
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(l)("query")), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          M("div", Da, [
            M("div", Ea, [
              e(k, {
                page: p.value,
                "onUpdate:page": A[5] || (A[5] = (B) => p.value = B),
                "page-size": s.value,
                "onUpdate:pageSize": A[6] || (A[6] = (B) => s.value = B),
                "item-count": v.value,
                "page-sizes": [
                  20,
                  50,
                  100
                ],
                "show-size-picker": ""
              }, {
                prefix: t(({ itemCount: B }) => [
                  _(o(a(l)("itemCount")) + ": " + o(B), 1)
                ]),
                _: 1
              }, 8, [
                "page",
                "page-size",
                "item-count"
              ])
            ]),
            e($, {
              columns: u,
              data: n.value,
              bordered: false,
              embedded: ""
            }, null, 8, [
              "data"
            ])
          ])
        ]);
      };
    }
  };
  Ra = Z($a, [
    [
      "__scopeId",
      "data-v-bd8929db"
    ]
  ]);
  Ba = {
    __name: "Statistics",
    setup(m) {
      const d = te(), { t: r } = ee({
        messages: {
          en: {
            userCount: "User Count",
            addressCount: "Address Count",
            activeAddressCount7days: "7 days Active Address Count",
            activeAddressCount30days: "30 days Active Address Count",
            mailCount: "Mail Count",
            sendMailCount: "Send Mail Count"
          },
          zh: {
            userCount: "\u7528\u6237\u603B\u6570",
            addressCount: "\u90AE\u7BB1\u5730\u5740\u603B\u6570",
            activeAddressCount7days: "7\u5929\u6D3B\u8DC3\u90AE\u7BB1\u5730\u5740\u603B\u6570",
            activeAddressCount30days: "30\u5929\u6D3B\u8DC3\u90AE\u7BB1\u5730\u5740\u603B\u6570",
            mailCount: "\u90AE\u4EF6\u603B\u6570",
            sendMailCount: "\u53D1\u9001\u90AE\u4EF6\u603B\u6570"
          }
        }
      }), l = f({
        addressCount: 0,
        userCount: 0,
        mailCount: 0,
        activeAddressCount7days: 0,
        activeAddressCount30days: 0,
        sendMailCount: 0
      }), n = async () => {
        try {
          const { userCount: v, mailCount: p, sendMailCount: s, addressCount: b, activeAddressCount7days: y, activeAddressCount30days: i } = await P.fetch("/admin/statistics");
          l.value.mailCount = p || 0, l.value.sendMailCount = s || 0, l.value.userCount = v || 0, l.value.addressCount = b || 0, l.value.activeAddressCount7days = y || 0, l.value.activeAddressCount30days = i || 0;
        } catch (v) {
          console.log(v), d.error(v.message || "error");
        }
      };
      return ae(async () => {
        await n();
      }), (v, p) => {
        const s = It, b = ka, y = ea, i = Zt, c = ue;
        return R(), J("div", null, [
          e(c, {
            bordered: false,
            embedded: ""
          }, {
            default: t(() => [
              e(i, null, {
                default: t(() => [
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("addressCount"),
                        value: l.value.addressCount
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(_t)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  }),
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("activeAddressCount7days"),
                        value: l.value.activeAddressCount7days
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(yt)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  }),
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("activeAddressCount30days"),
                        value: l.value.activeAddressCount30days
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(yt)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          e(c, {
            bordered: false,
            embedded: ""
          }, {
            default: t(() => [
              e(i, null, {
                default: t(() => [
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("userCount"),
                        value: l.value.userCount
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(_t)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  }),
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("mailCount"),
                        value: l.value.mailCount
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(Ta)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  }),
                  e(y, {
                    span: 8
                  }, {
                    default: t(() => [
                      e(b, {
                        label: a(r)("sendMailCount"),
                        value: l.value.sendMailCount
                      }, {
                        prefix: t(() => [
                          e(s, {
                            component: a(Ia)
                          }, null, 8, [
                            "component"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "label",
                        "value"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  Oa = Z(Ba, [
    [
      "__scopeId",
      "data-v-b73833c7"
    ]
  ]);
  za = {
    __name: "SendBox",
    setup(m) {
      const { adminSendBoxTabAddress: d } = ie(), { t: r } = ee({
        messages: {
          en: {
            query: "Query",
            queryTip: "Please input address to query, leave blank to query all"
          },
          zh: {
            query: "\u67E5\u8BE2",
            queryTip: "\u8BF7\u8F93\u5165\u5730\u5740\u67E5\u8BE2, \u7559\u7A7A\u5219\u67E5\u8BE2\u6240\u6709"
          }
        }
      }), l = async (v, p) => (d.value = d.value.trim(), await P.fetch(`/admin/sendbox?limit=${v}&offset=${p}` + (d.value ? `&address=${d.value}` : ""))), n = async (v) => {
        await P.fetch(`/admin/sendbox/${v}`, {
          method: "DELETE"
        });
      };
      return (v, p) => {
        const s = de, b = O, y = xe;
        return R(), J("div", null, [
          e(y, null, {
            default: t(() => [
              e(s, {
                value: a(d),
                "onUpdate:value": p[0] || (p[0] = (i) => ot(d) ? d.value = i : null),
                placeholder: a(r)("queryTip"),
                onKeydown: Ge(l, [
                  "enter"
                ])
              }, null, 8, [
                "value",
                "placeholder"
              ]),
              e(b, {
                onClick: l,
                type: "primary",
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(r)("query")), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          e(ta, {
            style: {
              "margin-top": "10px"
            },
            enableUserDeleteEmail: true,
            deleteMail: n,
            fetchMailData: l,
            showEMailFrom: true
          })
        ]);
      };
    }
  };
  Na = Z(za, [
    [
      "__scopeId",
      "data-v-fbae4450"
    ]
  ]);
  qa = {
    style: {
      "margin-top": "10px"
    }
  };
  Va = {
    style: {
      overflow: "auto"
    }
  };
  Fa = {
    style: {
      display: "inline-block"
    }
  };
  ja = {
    style: {
      "text-align": "center"
    }
  };
  Wa = {
    __name: "Account",
    setup(m) {
      const { loading: d, adminTab: r, openSettings: l, adminMailTabAddress: n, adminSendBoxTabAddress: v } = ie(), p = te(), { t: s } = ee({
        messages: {
          en: {
            name: "Name",
            created_at: "Created At",
            updated_at: "Update At",
            mail_count: "Mail Count",
            send_count: "Send Count",
            source_meta: "Source",
            showCredential: "Show Mail Address Credential",
            addressCredential: "Mail Address Credential",
            addressCredentialTip: "Please copy the Mail Address Credential and you can use it to login to your email account.",
            delete: "Delete",
            deleteTip: "Are you sure to delete this email?",
            deleteAccount: "Delete Account",
            viewMails: "View Mails",
            viewSendBox: "View SendBox",
            itemCount: "itemCount",
            query: "Query",
            addressQueryTip: "Leave blank to query all addresses",
            clearInbox: "Clear Inbox",
            clearSentItems: "Clear Sent Items",
            clearInboxTip: "Are you sure to clear inbox for this email?",
            clearSentItemsTip: "Are you sure to clear sent items for this email?",
            actions: "Actions",
            success: "Success",
            resetPassword: "Reset Password",
            newPassword: "New Password",
            passwordResetSuccess: "Password reset successfully",
            selectAll: "Select All of This Page",
            unselectAll: "Unselect All",
            pleaseSelectAddress: "Please select address",
            selectedItems: "Selected",
            multiDelete: "Multi Delete",
            multiDeleteTip: "Are you sure to delete selected addresses?",
            multiClearInbox: "Multi Clear Inbox",
            multiClearInboxTip: "Are you sure to clear inbox for selected addresses?",
            multiClearSentItems: "Multi Clear Sent Items",
            multiClearSentItemsTip: "Are you sure to clear sent items for selected addresses?"
          },
          zh: {
            name: "\u540D\u79F0",
            created_at: "\u521B\u5EFA\u65F6\u95F4",
            updated_at: "\u66F4\u65B0\u65F6\u95F4",
            mail_count: "\u90AE\u4EF6\u6570\u91CF",
            send_count: "\u53D1\u9001\u6570\u91CF",
            source_meta: "\u6765\u6E90",
            showCredential: "\u67E5\u770B\u90AE\u7BB1\u5730\u5740\u51ED\u8BC1",
            addressCredential: "\u90AE\u7BB1\u5730\u5740\u51ED\u8BC1",
            addressCredentialTip: "\u8BF7\u590D\u5236\u90AE\u7BB1\u5730\u5740\u51ED\u8BC1\uFF0C\u4F60\u53EF\u4EE5\u4F7F\u7528\u5B83\u767B\u5F55\u4F60\u7684\u90AE\u7BB1\u3002",
            delete: "\u5220\u9664",
            deleteTip: "\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A\u90AE\u7BB1\u5417\uFF1F",
            deleteAccount: "\u5220\u9664\u90AE\u7BB1",
            viewMails: "\u67E5\u770B\u90AE\u4EF6",
            viewSendBox: "\u67E5\u770B\u53D1\u4EF6\u7BB1",
            itemCount: "\u603B\u6570",
            query: "\u67E5\u8BE2",
            addressQueryTip: "\u7559\u7A7A\u67E5\u8BE2\u6240\u6709\u5730\u5740",
            clearInbox: "\u6E05\u7A7A\u6536\u4EF6\u7BB1",
            clearSentItems: "\u6E05\u7A7A\u53D1\u4EF6\u7BB1",
            clearInboxTip: "\u786E\u5B9A\u8981\u6E05\u7A7A\u8FD9\u4E2A\u90AE\u7BB1\u7684\u6536\u4EF6\u7BB1\u5417\uFF1F",
            clearSentItemsTip: "\u786E\u5B9A\u8981\u6E05\u7A7A\u8FD9\u4E2A\u90AE\u7BB1\u7684\u53D1\u4EF6\u7BB1\u5417\uFF1F",
            actions: "\u64CD\u4F5C",
            success: "\u6210\u529F",
            resetPassword: "\u91CD\u7F6E\u5BC6\u7801",
            newPassword: "\u65B0\u5BC6\u7801",
            passwordResetSuccess: "\u5BC6\u7801\u91CD\u7F6E\u6210\u529F",
            selectAll: "\u5168\u9009\u672C\u9875",
            unselectAll: "\u53D6\u6D88\u5168\u9009",
            pleaseSelectAddress: "\u8BF7\u9009\u62E9\u5730\u5740",
            selectedItems: "\u5DF2\u9009\u62E9",
            multiDelete: "\u6279\u91CF\u5220\u9664",
            multiDeleteTip: "\u786E\u5B9A\u8981\u5220\u9664\u9009\u4E2D\u7684\u90AE\u7BB1\u5417\uFF1F",
            multiClearInbox: "\u6279\u91CF\u6E05\u7A7A\u6536\u4EF6\u7BB1",
            multiClearInboxTip: "\u786E\u5B9A\u8981\u6E05\u7A7A\u9009\u4E2D\u90AE\u7BB1\u7684\u6536\u4EF6\u7BB1\u5417\uFF1F",
            multiClearSentItems: "\u6279\u91CF\u6E05\u7A7A\u53D1\u4EF6\u7BB1",
            multiClearSentItemsTip: "\u786E\u5B9A\u8981\u6E05\u7A7A\u9009\u4E2D\u90AE\u7BB1\u7684\u53D1\u4EF6\u7BB1\u5417\uFF1F"
          }
        }
      }), b = f(false), y = f(""), i = f(0), c = f(0), x = f(0), w = f(false), U = f(0), u = f(""), g = f([]), A = f(false), z = f({
        percentage: 0,
        tip: "0/0"
      }), j = f(""), T = ke(() => g.value.length), S = ke(() => g.value.length > 0), I = f(""), F = f([]), W = f(0), k = f(1), $ = f(20), B = f(false), Y = f(false), oe = f(false), ce = async (D) => {
        try {
          y.value = await P.adminShowAddressCredential(D), b.value = true;
        } catch (H) {
          p.error(H.message || "error"), b.value = false, y.value = "";
        }
      }, C = async () => {
        try {
          await P.adminDeleteAddress(i.value), p.success(s("success")), await ne();
        } catch (D) {
          p.error(D.message || "error");
        } finally {
          B.value = false;
        }
      }, E = async () => {
        try {
          await P.fetch(`/admin/clear_inbox/${c.value}`, {
            method: "DELETE"
          }), p.success(s("success")), await ne();
        } catch (D) {
          p.error(D.message || "error");
        } finally {
          Y.value = false;
        }
      }, N = async () => {
        try {
          await P.fetch(`/admin/clear_sent_items/${x.value}`, {
            method: "DELETE"
          }), p.success(s("success")), await ne();
        } catch (D) {
          p.error(D.message || "error");
        } finally {
          oe.value = false;
        }
      }, pe = async () => {
        try {
          await P.fetch(`/admin/address/${U.value}/reset_password`, {
            method: "POST",
            body: JSON.stringify({
              password: u.value
            })
          }), p.success(s("passwordResetSuccess")), u.value = "", w.value = false;
        } catch (D) {
          p.error(D.message || "error");
        }
      }, Q = () => {
        g.value = F.value.map((D) => D.id);
      }, me = () => {
        g.value = [];
      }, Ue = async ({ shouldSkip: D = () => false, apiCall: H, title: je, operationName: _e = "operation" }) => {
        try {
          d.value = true;
          const fe = F.value.filter((ve) => g.value.includes(ve.id));
          if (fe.length === 0) {
            p.error(s("pleaseSelectAddress"));
            return;
          }
          const Ee = [], Ie = fe.length;
          z.value = {
            percentage: 0,
            tip: `0/${Ie}`
          }, j.value = je, A.value = true;
          for (const [ve, Ae] of fe.entries()) {
            try {
              D(Ae) || await H(Ae.id);
            } catch ($e) {
              console.error(`${_e} failed for address ${Ae.id}:`, $e), Ee.push(Ae.id);
            }
            z.value = {
              percentage: Math.floor((ve + 1) / Ie * 100),
              tip: `${ve + 1}/${Ie}`
            };
          }
          await ne(), g.value = Ee, p.success(s("success"));
        } catch (fe) {
          p.error(fe.message || "error");
        } finally {
          d.value = false;
        }
      }, Fe = async () => {
        await Ue({
          apiCall: (D) => P.adminDeleteAddress(D),
          title: s("multiDelete") + " " + s("success"),
          operationName: "Delete"
        });
      }, he = async () => {
        await Ue({
          shouldSkip: (D) => D.mail_count <= 0,
          apiCall: (D) => P.fetch(`/admin/clear_inbox/${D}`, {
            method: "DELETE"
          }),
          title: s("multiClearInbox") + " " + s("success"),
          operationName: "ClearInbox"
        });
      }, ye = async () => {
        await Ue({
          shouldSkip: (D) => D.send_count <= 0,
          apiCall: (D) => P.fetch(`/admin/clear_sent_items/${D}`, {
            method: "DELETE"
          }),
          title: s("multiClearSentItems") + " " + s("success"),
          operationName: "ClearSentItems"
        });
      }, ne = async () => {
        try {
          I.value = I.value.trim();
          const { results: D, count: H } = await P.fetch(`/admin/address?limit=${$.value}&offset=${(k.value - 1) * $.value}` + (I.value ? `&query=${I.value}` : ""));
          F.value = D, H > 0 && (W.value = H);
        } catch (D) {
          console.error(D), p.error(D.message || "error");
        }
      }, G = [
        {
          type: "selection"
        },
        {
          title: "ID",
          key: "id"
        },
        {
          title: s("name"),
          key: "name"
        },
        {
          title: s("created_at"),
          key: "created_at"
        },
        {
          title: s("updated_at"),
          key: "updated_at"
        },
        {
          title: s("source_meta"),
          key: "source_meta"
        },
        {
          title: s("mail_count"),
          key: "mail_count",
          render(D) {
            return L(O, {
              text: true,
              onClick: () => {
                D.mail_count > 0 && (n.value = D.name, r.value = "mails");
              }
            }, {
              icon: () => L(He, {
                value: D.mail_count,
                "show-zero": true,
                max: 99,
                type: "success"
              }),
              default: () => D.mail_count > 0 ? s("viewMails") : ""
            });
          }
        },
        {
          title: s("send_count"),
          key: "send_count",
          render(D) {
            return L(O, {
              text: true,
              onClick: () => {
                D.send_count > 0 && (v.value = D.name, r.value = "sendBox");
              }
            }, {
              icon: () => L(He, {
                value: D.send_count,
                "show-zero": true,
                max: 99,
                type: "success"
              }),
              default: () => D.send_count > 0 ? s("viewSendBox") : ""
            });
          }
        },
        {
          title: s("actions"),
          key: "actions",
          render(D) {
            var _a2;
            return L("div", [
              L(Mt, {
                mode: "horizontal",
                options: [
                  {
                    label: s("actions"),
                    icon: () => L(Tt),
                    key: "action",
                    children: [
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => ce(D.id)
                        }, {
                          default: () => s("showCredential")
                        })
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            n.value = D.name, r.value = "mails";
                          }
                        }, {
                          default: () => s("viewMails")
                        }),
                        show: D.mail_count > 0
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            v.value = D.name, r.value = "sendBox";
                          }
                        }, {
                          default: () => s("viewSendBox")
                        }),
                        show: D.send_count > 0
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            c.value = D.id, Y.value = true;
                          }
                        }, {
                          default: () => s("clearInbox")
                        }),
                        show: D.mail_count > 0
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            x.value = D.id, oe.value = true;
                          }
                        }, {
                          default: () => s("clearSentItems")
                        }),
                        show: D.send_count > 0
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            U.value = D.id, w.value = true;
                          }
                        }, {
                          default: () => s("resetPassword")
                        }),
                        show: (_a2 = l.value) == null ? void 0 : _a2.enableAddressPassword
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            i.value = D.id, B.value = true;
                          }
                        }, {
                          default: () => s("delete")
                        })
                      }
                    ]
                  }
                ]
              })
            ]);
          }
        }
      ];
      return Ye([
        k,
        $
      ], async () => {
        await ne();
      }), ae(async () => {
        await ne();
      }), (D, H) => {
        const je = ue, _e = Pe, fe = de, Ee = Ut, Ie = xe, ve = Ze, Ae = rt, $e = qe, h = st, q = Ne, K = aa;
        return R(), J("div", qa, [
          e(_e, {
            show: b.value,
            "onUpdate:show": H[0] || (H[0] = (V) => b.value = V),
            preset: "dialog",
            title: "Dialog"
          }, {
            header: t(() => [
              M("div", null, o(a(s)("addressCredential")), 1)
            ]),
            action: t(() => [
              ...H[11] || (H[11] = [])
            ]),
            default: t(() => [
              M("span", null, [
                M("p", null, o(a(s)("addressCredentialTip")), 1)
              ]),
              e(je, {
                bordered: false,
                embedded: ""
              }, {
                default: t(() => [
                  M("b", null, o(y.value), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show"
          ]),
          e(_e, {
            show: B.value,
            "onUpdate:show": H[1] || (H[1] = (V) => B.value = V),
            preset: "dialog",
            title: a(s)("deleteAccount")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: C,
                size: "small",
                tertiary: "",
                type: "error"
              }, {
                default: t(() => [
                  _(o(a(s)("deleteAccount")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(s)("deleteTip")), 1)
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(_e, {
            show: Y.value,
            "onUpdate:show": H[2] || (H[2] = (V) => Y.value = V),
            preset: "dialog",
            title: a(s)("clearInbox")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: E,
                size: "small",
                tertiary: "",
                type: "error"
              }, {
                default: t(() => [
                  _(o(a(s)("clearInbox")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(s)("clearInboxTip")), 1)
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(_e, {
            show: oe.value,
            "onUpdate:show": H[3] || (H[3] = (V) => oe.value = V),
            preset: "dialog",
            title: a(s)("clearSentItems")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: N,
                size: "small",
                tertiary: "",
                type: "error"
              }, {
                default: t(() => [
                  _(o(a(s)("clearSentItems")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(s)("clearSentItemsTip")), 1)
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(_e, {
            show: w.value,
            "onUpdate:show": H[5] || (H[5] = (V) => w.value = V),
            preset: "dialog",
            title: a(s)("resetPassword")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: pe,
                size: "small",
                tertiary: "",
                type: "info"
              }, {
                default: t(() => [
                  _(o(a(s)("resetPassword")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              e(Ee, {
                label: a(s)("newPassword")
              }, {
                default: t(() => [
                  e(fe, {
                    value: u.value,
                    "onUpdate:value": H[4] || (H[4] = (V) => u.value = V),
                    type: "password",
                    placeholder: "",
                    "show-password-on": "click"
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ])
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(Ie, {
            style: {
              "margin-bottom": "10px"
            }
          }, {
            default: t(() => [
              e(fe, {
                value: I.value,
                "onUpdate:value": H[6] || (H[6] = (V) => I.value = V),
                clearable: "",
                placeholder: a(s)("addressQueryTip"),
                onKeydown: Ge(ne, [
                  "enter"
                ])
              }, null, 8, [
                "value",
                "placeholder"
              ]),
              e(a(O), {
                onClick: ne,
                type: "primary",
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(s)("query")), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          S.value ? (R(), X($e, {
            key: 0,
            style: {
              "margin-bottom": "10px"
            }
          }, {
            default: t(() => [
              e(a(O), {
                onClick: Q,
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(s)("selectAll")), 1)
                ]),
                _: 1
              }),
              e(a(O), {
                onClick: me,
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(s)("unselectAll")), 1)
                ]),
                _: 1
              }),
              e(ve, {
                onPositiveClick: Fe
              }, {
                trigger: t(() => [
                  e(a(O), {
                    tertiary: "",
                    type: "error"
                  }, {
                    default: t(() => [
                      _(o(a(s)("multiDelete")), 1)
                    ]),
                    _: 1
                  })
                ]),
                default: t(() => [
                  _(" " + o(a(s)("multiDeleteTip")), 1)
                ]),
                _: 1
              }),
              e(ve, {
                onPositiveClick: he
              }, {
                trigger: t(() => [
                  e(a(O), {
                    tertiary: "",
                    type: "warning"
                  }, {
                    default: t(() => [
                      _(o(a(s)("multiClearInbox")), 1)
                    ]),
                    _: 1
                  })
                ]),
                default: t(() => [
                  _(" " + o(a(s)("multiClearInboxTip")), 1)
                ]),
                _: 1
              }),
              e(ve, {
                onPositiveClick: ye
              }, {
                trigger: t(() => [
                  e(a(O), {
                    tertiary: "",
                    type: "warning"
                  }, {
                    default: t(() => [
                      _(o(a(s)("multiClearSentItems")), 1)
                    ]),
                    _: 1
                  })
                ]),
                default: t(() => [
                  _(" " + o(a(s)("multiClearSentItemsTip")), 1)
                ]),
                _: 1
              }),
              e(Ae, {
                type: "info"
              }, {
                default: t(() => [
                  _(o(a(s)("selectedItems")) + ": " + o(T.value), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          })) : le("", true),
          M("div", Va, [
            M("div", Fa, [
              e(h, {
                page: k.value,
                "onUpdate:page": H[7] || (H[7] = (V) => k.value = V),
                "page-size": $.value,
                "onUpdate:pageSize": H[8] || (H[8] = (V) => $.value = V),
                "item-count": W.value,
                "page-sizes": [
                  20,
                  50,
                  100
                ],
                "show-size-picker": ""
              }, {
                prefix: t(({ itemCount: V }) => [
                  _(o(a(s)("itemCount")) + ": " + o(V), 1)
                ]),
                _: 1
              }, 8, [
                "page",
                "page-size",
                "item-count"
              ])
            ]),
            e(q, {
              "checked-row-keys": g.value,
              "onUpdate:checkedRowKeys": H[9] || (H[9] = (V) => g.value = V),
              columns: G,
              data: F.value,
              bordered: false,
              "row-key": (V) => V.id,
              embedded: ""
            }, null, 8, [
              "checked-row-keys",
              "data",
              "row-key"
            ])
          ]),
          e(_e, {
            show: A.value,
            "onUpdate:show": H[10] || (H[10] = (V) => A.value = V),
            preset: "dialog",
            title: j.value,
            "negative-text": "OK"
          }, {
            default: t(() => [
              e($e, {
                justify: "center"
              }, {
                default: t(() => [
                  e(K, {
                    type: "circle",
                    status: "info",
                    percentage: z.value.percentage
                  }, {
                    default: t(() => [
                      M("span", ja, o(z.value.tip), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "percentage"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ])
        ]);
      };
    }
  };
  Ha = Z(Wa, [
    [
      "__scopeId",
      "data-v-2b531726"
    ]
  ]);
  Ka = {
    class: "center"
  };
  Ga = {
    __name: "CreateAccount",
    setup(m) {
      const { loading: d, openSettings: r } = ie(), l = te(), { t: n } = ee({
        messages: {
          en: {
            address: "Address",
            enablePrefix: "If enable Prefix",
            creatNewEmail: "Create New Email",
            fillInAllFields: "Please fill in all fields",
            successTip: "Success Created",
            addressCredential: "Mail Address Credential",
            addressCredentialTip: "Please copy the Mail Address Credential and you can use it to login to your email account.",
            addressPassword: "Address Password",
            linkWithAddressCredential: "Open to auto login email link"
          },
          zh: {
            address: "\u5730\u5740",
            enablePrefix: "\u662F\u5426\u542F\u7528\u524D\u7F00",
            creatNewEmail: "\u521B\u5EFA\u65B0\u90AE\u7BB1",
            fillInAllFields: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F",
            successTip: "\u521B\u5EFA\u6210\u529F",
            addressCredential: "\u90AE\u7BB1\u5730\u5740\u51ED\u8BC1",
            addressCredentialTip: "\u8BF7\u590D\u5236\u90AE\u7BB1\u5730\u5740\u51ED\u8BC1\uFF0C\u4F60\u53EF\u4EE5\u4F7F\u7528\u5B83\u767B\u5F55\u4F60\u7684\u90AE\u7BB1\u3002",
            addressPassword: "\u5730\u5740\u5BC6\u7801",
            linkWithAddressCredential: "\u6253\u5F00\u5373\u53EF\u81EA\u52A8\u767B\u5F55\u90AE\u7BB1\u7684\u94FE\u63A5"
          }
        }
      }), v = f(true), p = f(""), s = f(""), b = f(false), y = f(""), i = f(""), c = f(""), x = async () => {
        if (!p.value || !s.value) {
          l.error(n("fillInAllFields"));
          return;
        }
        try {
          const U = await P.fetch("/admin/new_address", {
            method: "POST",
            body: JSON.stringify({
              enablePrefix: v.value,
              name: p.value,
              domain: s.value
            })
          });
          y.value = U.jwt, i.value = U.password || "", c.value = U.address || "", l.success(n("successTip")), b.value = true;
        } catch (U) {
          l.error(U.message || "error");
        }
      }, w = () => `${window.location.origin}/?jwt=${y.value}`;
      return ae(async () => {
        var _a2, _b;
        r.prefix && (v.value = true), s.value = ((_b = (_a2 = r.value.domains) == null ? void 0 : _a2[0]) == null ? void 0 : _b.value) || "";
      }), (U, u) => {
        const g = ue, A = Dt, z = Pt, j = Pe, T = Ve, S = ge, I = la, F = de, W = se, k = xe, $ = O;
        return R(), J("div", Ka, [
          e(j, {
            show: b.value,
            "onUpdate:show": u[0] || (u[0] = (B) => b.value = B),
            preset: "dialog",
            title: a(n)("addressCredential")
          }, {
            default: t(() => [
              M("span", null, [
                M("p", null, o(a(n)("addressCredentialTip")), 1)
              ]),
              e(g, {
                embedded: ""
              }, {
                default: t(() => [
                  M("b", null, o(y.value), 1)
                ]),
                _: 1
              }),
              i.value ? (R(), X(g, {
                key: 0,
                embedded: ""
              }, {
                default: t(() => [
                  M("p", null, [
                    M("b", null, o(c.value), 1)
                  ]),
                  M("p", null, [
                    _(o(a(n)("addressPassword")) + ": ", 1),
                    M("b", null, o(i.value), 1)
                  ])
                ]),
                _: 1
              })) : le("", true),
              e(g, {
                embedded: ""
              }, {
                default: t(() => [
                  e(z, null, {
                    default: t(() => [
                      e(A, {
                        title: a(n)("linkWithAddressCredential")
                      }, {
                        default: t(() => [
                          e(g, {
                            embedded: ""
                          }, {
                            default: t(() => [
                              M("b", null, o(w()), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }, 8, [
                        "title"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(g, {
            bordered: false,
            embedded: "",
            style: {
              "max-width": "600px"
            }
          }, {
            default: t(() => [
              a(r).prefix ? (R(), X(S, {
                key: 0,
                label: a(n)("enablePrefix")
              }, {
                default: t(() => [
                  e(T, {
                    value: v.value,
                    "onUpdate:value": u[1] || (u[1] = (B) => v.value = B),
                    round: false
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ])) : le("", true),
              e(S, {
                label: a(n)("address")
              }, {
                default: t(() => [
                  e(k, null, {
                    default: t(() => [
                      v.value && a(r).prefix ? (R(), X(I, {
                        key: 0
                      }, {
                        default: t(() => [
                          _(o(a(r).prefix), 1)
                        ]),
                        _: 1
                      })) : le("", true),
                      e(F, {
                        value: p.value,
                        "onUpdate:value": u[2] || (u[2] = (B) => p.value = B)
                      }, null, 8, [
                        "value"
                      ]),
                      e(I, null, {
                        default: t(() => [
                          ...u[4] || (u[4] = [
                            _("@", -1)
                          ])
                        ]),
                        _: 1
                      }),
                      e(W, {
                        value: s.value,
                        "onUpdate:value": u[3] || (u[3] = (B) => s.value = B),
                        "consistent-menu-width": false,
                        options: a(r).domains
                      }, null, 8, [
                        "value",
                        "options"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "label"
              ]),
              e($, {
                onClick: x,
                type: "primary",
                block: "",
                loading: a(d)
              }, {
                default: t(() => [
                  _(o(a(n)("creatNewEmail")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  Ja = Z(Ga, [
    [
      "__scopeId",
      "data-v-22702c12"
    ]
  ]);
  Qa = {
    class: "center"
  };
  Xa = 200;
  Ya = {
    __name: "AccountSettings",
    setup(m) {
      const { loading: d, openSettings: r } = ie(), l = te(), { t: n } = ee({
        messages: {
          en: {
            tip: "You can manually input the following multiple select input and enter",
            manualInputPrompt: "Type and press Enter to add",
            save: "Save",
            successTip: "Save Success",
            address_block_list: "Address Block Keywords for Users(Admin can skip)",
            address_block_list_placeholder: "Please enter the keywords you want to block",
            send_address_block_list: "Address Block Keywords for send email",
            noLimitSendAddressList: "No Balance Limit Send Address List",
            verified_address_list: "Verified Address List(Can send email by cf internal api)",
            fromBlockList: "Block Keywords for receive email",
            block_receive_unknow_address_email: "Block receive unknow address email",
            email_forwarding_config: "Email Forwarding Configuration",
            domain_list: "Domain List (Optional)",
            forward_address: "Forward Address",
            actions: "Actions",
            select_domain: "Select Domain",
            forward_placeholder: "forward@example.com",
            delete_rule: "Delete",
            delete_rule_confirm: "Are you sure you want to delete this rule?",
            delete_success: "Delete Success",
            forwarding_rule_warning: "Each rule will run independently. Forward address needs to be a verified address.",
            add: "Add",
            cancel: "Cancel",
            config: "Config",
            source_patterns: "Source Address Regex (Optional)",
            source_patterns_placeholder: "e.g. gmail.com",
            source_match_mode: "Match Mode",
            match_any: "Any",
            match_all: "All",
            source_patterns_tip: "Domain list filters by recipient address, source regex filters by sender address. Both conditions must match for forwarding (AND logic). Leave either empty to skip that filter.",
            regex_too_long: "Regex pattern too long (max 200 characters)",
            regex_invalid: "Invalid regex pattern",
            forward_address_required: "Forward address is required",
            rule_index: "Rule"
          },
          zh: {
            tip: "\u60A8\u53EF\u4EE5\u624B\u52A8\u8F93\u5165\u4EE5\u4E0B\u591A\u9009\u8F93\u5165\u6846, \u56DE\u8F66\u589E\u52A0",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            save: "\u4FDD\u5B58",
            successTip: "\u4FDD\u5B58\u6210\u529F",
            address_block_list: "\u90AE\u4EF6\u5730\u5740\u5C4F\u853D\u5173\u952E\u8BCD(\u7BA1\u7406\u5458\u53EF\u8DF3\u8FC7\u68C0\u67E5)",
            address_block_list_placeholder: "\u8BF7\u8F93\u5165\u60A8\u60F3\u8981\u5C4F\u853D\u7684\u5173\u952E\u8BCD",
            send_address_block_list: "\u53D1\u9001\u90AE\u4EF6\u5730\u5740\u5C4F\u853D\u5173\u952E\u8BCD",
            noLimitSendAddressList: "\u65E0\u4F59\u989D\u9650\u5236\u53D1\u9001\u5730\u5740\u5217\u8868",
            verified_address_list: "\u5DF2\u9A8C\u8BC1\u5730\u5740\u5217\u8868(\u53EF\u901A\u8FC7 cf \u5185\u90E8 api \u53D1\u9001\u90AE\u4EF6)",
            fromBlockList: "\u63A5\u6536\u90AE\u4EF6\u5730\u5740\u5C4F\u853D\u5173\u952E\u8BCD",
            block_receive_unknow_address_email: "\u7981\u6B62\u63A5\u6536\u672A\u77E5\u5730\u5740\u90AE\u4EF6",
            email_forwarding_config: "\u90AE\u4EF6\u8F6C\u53D1\u914D\u7F6E",
            domain_list: "\u57DF\u540D\u5217\u8868\uFF08\u53EF\u9009\uFF09",
            forward_address: "\u8F6C\u53D1\u5730\u5740",
            actions: "\u64CD\u4F5C",
            select_domain: "\u9009\u62E9\u57DF\u540D",
            forward_placeholder: "forward@example.com",
            delete_rule: "\u5220\u9664",
            delete_rule_confirm: "\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u6761\u89C4\u5219\u5417\uFF1F",
            delete_success: "\u5220\u9664\u6210\u529F",
            forwarding_rule_warning: "\u6BCF\u6761\u89C4\u5219\u72EC\u7ACB\u8FD0\u884C\uFF0C\u8F6C\u53D1\u5730\u5740\u9700\u8981\u4E3A\u5DF2\u9A8C\u8BC1\u7684\u5730\u5740\u3002",
            add: "\u6DFB\u52A0",
            cancel: "\u53D6\u6D88",
            config: "\u914D\u7F6E",
            source_patterns: "\u6765\u6E90\u5730\u5740\u6B63\u5219\uFF08\u53EF\u9009\uFF09",
            source_patterns_placeholder: "\u4F8B\u5982: gmail.com",
            source_match_mode: "\u5339\u914D\u6A21\u5F0F",
            match_any: "\u4EFB\u4E00",
            match_all: "\u5168\u90E8",
            source_patterns_tip: "\u57DF\u540D\u5217\u8868\u6309\u6536\u4EF6\u5730\u5740\u8FC7\u6EE4\uFF0C\u6765\u6E90\u6B63\u5219\u6309\u53D1\u4EF6\u5730\u5740\u8FC7\u6EE4\uFF0C\u4E24\u8005\u5747\u4E3A\u53EF\u9009\u3002\u540C\u65F6\u914D\u7F6E\u65F6\u9700\u540C\u65F6\u6EE1\u8DB3\uFF08AND \u903B\u8F91\uFF09\uFF0C\u7559\u7A7A\u5219\u8DF3\u8FC7\u8BE5\u6761\u4EF6\u3002",
            regex_too_long: "\u6B63\u5219\u8868\u8FBE\u5F0F\u8FC7\u957F\uFF08\u6700\u5927200\u5B57\u7B26\uFF09",
            regex_invalid: "\u65E0\u6548\u7684\u6B63\u5219\u8868\u8FBE\u5F0F",
            forward_address_required: "\u8F6C\u53D1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A",
            rule_index: "\u89C4\u5219"
          }
        }
      }), v = f([]), p = f([]), s = f([]), b = f([]), y = f([]), i = f({
        blockReceiveUnknowAddressEmail: false,
        emailForwardingList: []
      }), c = f(false), x = f([]), w = [
        {
          title: n("domain_list"),
          key: "domains",
          render: (T, S) => {
            var _a2;
            return L(se, {
              value: Array.isArray(T.domains) ? T.domains : [],
              onUpdateValue: (I) => {
                x.value[S].domains = I;
              },
              options: ((_a2 = r.value) == null ? void 0 : _a2.domains) || [],
              multiple: true,
              filterable: true,
              tag: true,
              placeholder: n("select_domain")
            });
          }
        },
        {
          title: n("source_patterns"),
          key: "sourcePatterns",
          render: (T, S) => L("div", {
            style: "display: flex; flex-direction: column; gap: 4px;"
          }, [
            L(se, {
              value: Array.isArray(T.sourcePatterns) ? T.sourcePatterns : [],
              onUpdateValue: (I) => {
                x.value[S].sourcePatterns = I;
              },
              multiple: true,
              filterable: true,
              tag: true,
              placeholder: n("source_patterns_placeholder")
            }, {
              empty: () => L("span", {
                style: "color: #999; font-size: 12px;"
              }, n("manualInputPrompt"))
            }),
            L(Et, {
              value: T.sourceMatchMode || "any",
              onUpdateValue: (I) => {
                x.value[S].sourceMatchMode = I;
              },
              size: "small",
              style: "margin-top: 4px;"
            }, {
              default: () => [
                L(ft, {
                  value: "any"
                }, {
                  default: () => n("match_any")
                }),
                L(ft, {
                  value: "all"
                }, {
                  default: () => n("match_all")
                })
              ]
            })
          ])
        },
        {
          title: n("forward_address"),
          key: "forward",
          render: (T, S) => L(de, {
            value: T.forward,
            onUpdateValue: (I) => {
              x.value[S].forward = I;
            },
            placeholder: "forward@example.com"
          })
        },
        {
          title: n("actions"),
          key: "actions",
          render: (T, S) => L("div", {
            style: "display: flex; gap: 8px;"
          }, [
            L(Ze, {
              onPositiveClick: () => {
                x.value = x.value.filter((I, F) => F !== S), l.success(n("delete_success"));
              }
            }, {
              default: () => n("delete_rule_confirm"),
              trigger: () => L(O, {
                size: "small",
                type: "error"
              }, {
                default: () => n("delete_rule")
              })
            })
          ])
        }
      ], U = () => {
        x.value = i.value.emailForwardingList ? [
          ...i.value.emailForwardingList
        ] : [], c.value = true;
      }, u = () => {
        x.value = [
          ...x.value,
          {
            domains: [],
            forward: "",
            sourcePatterns: [],
            sourceMatchMode: "any"
          }
        ];
      }, g = () => {
        for (let T = 0; T < x.value.length; T++) {
          const S = x.value[T];
          if (!S.forward || S.forward.trim() === "") return l.error(`${n("forward_address_required")} (${n("rule_index")} ${T + 1})`), false;
          if (S.sourcePatterns && S.sourcePatterns.length > 0) for (const I of S.sourcePatterns) {
            if (I.length > Xa) return l.error(`${n("regex_too_long")}: ${I.substring(0, 30)}...`), false;
            try {
              new RegExp(I, "i");
            } catch {
              return l.error(`${n("regex_invalid")}: ${I}`), false;
            }
          }
        }
        return true;
      }, A = () => {
        g() && (i.value.emailForwardingList = [
          ...x.value
        ], c.value = false);
      }, z = async () => {
        var _a2, _b;
        try {
          const T = await P.fetch("/admin/account_settings");
          v.value = T.blockList || [], p.value = T.sendBlockList || [], b.value = T.verifiedAddressList || [], y.value = T.fromBlockList || [], s.value = T.noLimitSendAddressList || [], i.value = {
            blockReceiveUnknowAddressEmail: ((_a2 = T.emailRuleSettings) == null ? void 0 : _a2.blockReceiveUnknowAddressEmail) || false,
            emailForwardingList: ((_b = T.emailRuleSettings) == null ? void 0 : _b.emailForwardingList) || []
          };
        } catch (T) {
          l.error(T.message || "error");
        }
      }, j = async () => {
        try {
          await P.fetch("/admin/account_settings", {
            method: "POST",
            body: JSON.stringify({
              blockList: v.value || [],
              sendBlockList: p.value || [],
              verifiedAddressList: b.value || [],
              fromBlockList: y.value || [],
              noLimitSendAddressList: s.value || [],
              emailRuleSettings: i.value
            })
          }), l.success(n("successTip"));
        } catch (T) {
          l.error(T.message || "error");
        }
      };
      return ae(async () => {
        await z();
      }), (T, S) => {
        const I = Se, F = De, W = Le, k = ge, $ = Ve, B = ue, Y = qe, oe = Ne, ce = Pe;
        return R(), J(it, null, [
          M("div", Qa, [
            e(B, {
              bordered: false,
              embedded: "",
              style: {
                "max-width": "600px"
              }
            }, {
              default: t(() => [
                e(I, {
                  "show-icon": false,
                  bordered: false,
                  type: "warning",
                  style: {
                    "margin-bottom": "10px"
                  }
                }, {
                  default: t(() => [
                    M("span", null, o(a(n)("tip")), 1)
                  ]),
                  _: 1
                }),
                e(F, {
                  justify: "end"
                }, {
                  default: t(() => [
                    e(a(O), {
                      onClick: j,
                      type: "primary",
                      loading: a(d)
                    }, {
                      default: t(() => [
                        _(o(a(n)("save")), 1)
                      ]),
                      _: 1
                    }, 8, [
                      "loading"
                    ])
                  ]),
                  _: 1
                }),
                e(k, {
                  label: a(n)("address_block_list")
                }, {
                  default: t(() => [
                    e(a(se), {
                      value: v.value,
                      "onUpdate:value": S[0] || (S[0] = (C) => v.value = C),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(n)("address_block_list_placeholder")
                    }, {
                      empty: t(() => [
                        e(W, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(n)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("send_address_block_list")
                }, {
                  default: t(() => [
                    e(a(se), {
                      value: p.value,
                      "onUpdate:value": S[1] || (S[1] = (C) => p.value = C),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(n)("address_block_list_placeholder")
                    }, {
                      empty: t(() => [
                        e(W, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(n)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("noLimitSendAddressList")
                }, {
                  default: t(() => [
                    e(a(se), {
                      value: s.value,
                      "onUpdate:value": S[2] || (S[2] = (C) => s.value = C),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(n)("noLimitSendAddressList")
                    }, {
                      empty: t(() => [
                        e(W, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(n)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("verified_address_list")
                }, {
                  default: t(() => [
                    e(a(se), {
                      value: b.value,
                      "onUpdate:value": S[3] || (S[3] = (C) => b.value = C),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(n)("verified_address_list")
                    }, {
                      empty: t(() => [
                        e(W, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(n)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("fromBlockList")
                }, {
                  default: t(() => [
                    e(a(se), {
                      value: y.value,
                      "onUpdate:value": S[4] || (S[4] = (C) => y.value = C),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(n)("fromBlockList")
                    }, {
                      empty: t(() => [
                        e(W, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(n)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("block_receive_unknow_address_email")
                }, {
                  default: t(() => [
                    e($, {
                      value: i.value.blockReceiveUnknowAddressEmail,
                      "onUpdate:value": S[5] || (S[5] = (C) => i.value.blockReceiveUnknowAddressEmail = C),
                      round: false
                    }, null, 8, [
                      "value"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(k, {
                  label: a(n)("email_forwarding_config")
                }, {
                  default: t(() => [
                    e(a(O), {
                      onClick: U
                    }, {
                      default: t(() => [
                        _(o(a(n)("config")), 1)
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ])
              ]),
              _: 1
            })
          ]),
          e(ce, {
            show: c.value,
            "onUpdate:show": S[6] || (S[6] = (C) => c.value = C),
            preset: "card",
            title: a(n)("email_forwarding_config"),
            style: {
              "max-width": "1000px"
            }
          }, {
            default: t(() => [
              e(Y, {
                vertical: ""
              }, {
                default: t(() => [
                  e(I, {
                    "show-icon": false,
                    bordered: false,
                    type: "warning"
                  }, {
                    default: t(() => [
                      M("span", null, o(a(n)("forwarding_rule_warning")), 1),
                      S[7] || (S[7] = M("br", null, null, -1)),
                      M("span", null, o(a(n)("source_patterns_tip")), 1)
                    ]),
                    _: 1
                  }),
                  e(Y, {
                    justify: "end"
                  }, {
                    default: t(() => [
                      e(a(O), {
                        onClick: u
                      }, {
                        default: t(() => [
                          _(o(a(n)("add")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  e(oe, {
                    columns: w,
                    data: x.value,
                    bordered: false,
                    striped: ""
                  }, null, 8, [
                    "data"
                  ]),
                  e(Y, {
                    justify: "end"
                  }, {
                    default: t(() => [
                      e(a(O), {
                        onClick: A,
                        type: "primary"
                      }, {
                        default: t(() => [
                          _(o(a(n)("save")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ])
        ], 64);
      };
    }
  };
  wt = Z(Ya, [
    [
      "__scopeId",
      "data-v-e681a103"
    ]
  ]);
  Za = {
    style: {
      overflow: "auto"
    }
  };
  el = {
    __name: "UserAddressManagement",
    props: {
      user_id: {
        type: Number,
        required: true
      }
    },
    setup(m) {
      const d = m, r = te(), { locale: l, t: n } = ee({
        messages: {
          en: {
            success: "success",
            name: "Name",
            mail_count: "Mail Count",
            send_count: "Send Count"
          },
          zh: {
            success: "\u6210\u529F",
            name: "\u540D\u79F0",
            mail_count: "\u90AE\u4EF6\u6570\u91CF",
            send_count: "\u53D1\u9001\u6570\u91CF"
          }
        }
      }), v = f([]), p = async () => {
        try {
          const { results: b } = await P.fetch(`/admin/users/bind_address/${d.user_id}`);
          v.value = b;
        } catch (b) {
          console.log(b), r.error(b.message || "error");
        }
      }, s = [
        {
          title: n("name"),
          key: "name"
        },
        {
          title: n("mail_count"),
          key: "mail_count",
          render(b) {
            return L(He, {
              value: b.mail_count,
              "show-zero": true,
              max: 99,
              type: "success"
            });
          }
        },
        {
          title: n("send_count"),
          key: "send_count",
          render(b) {
            return L(He, {
              value: b.send_count,
              "show-zero": true,
              max: 99,
              type: "success"
            });
          }
        }
      ];
      return ae(async () => {
        await p();
      }), (b, y) => {
        const i = Ne;
        return R(), J("div", Za, [
          e(i, {
            columns: s,
            data: v.value,
            bordered: false,
            embedded: ""
          }, null, 8, [
            "data"
          ])
        ]);
      };
    }
  };
  tl = Z(el, [
    [
      "__scopeId",
      "data-v-b33d0779"
    ]
  ]);
  al = {
    style: {
      "margin-top": "10px"
    }
  };
  ll = {
    style: {
      overflow: "auto"
    }
  };
  nl = {
    style: {
      display: "inline-block"
    }
  };
  sl = {
    __name: "UserManagement",
    setup(m) {
      const { loading: d, openSettings: r } = ie(), l = te(), { t: n } = ee({
        messages: {
          en: {
            success: "Success",
            user_email: "User Email",
            role: "Role",
            address_count: "Address Count",
            created_at: "Created At",
            actions: "Actions",
            query: "Query",
            itemCount: "itemCount",
            deleteUser: "Delete User",
            delete: "Delete",
            deleteUserTip: "Are you sure you want to delete this user?",
            resetPassword: "Reset Password",
            pleaseInput: "Please input complete information",
            createUser: "Create User",
            email: "Email",
            password: "Password",
            changeRole: "Change Role",
            prefix: "Prefix",
            domains: "Domains",
            roleDonotExist: "Current Role does not exist",
            userAddressManagement: "Address Management"
          },
          zh: {
            success: "\u6210\u529F",
            user_email: "\u7528\u6237\u90AE\u7BB1",
            role: "\u89D2\u8272",
            address_count: "\u5730\u5740\u6570\u91CF",
            created_at: "\u521B\u5EFA\u65F6\u95F4",
            actions: "\u64CD\u4F5C",
            query: "\u67E5\u8BE2",
            itemCount: "\u603B\u6570",
            deleteUser: "\u5220\u9664\u7528\u6237",
            delete: "\u5220\u9664",
            deleteUserTip: "\u786E\u5B9A\u8981\u5220\u9664\u6B64\u7528\u6237\u5417\uFF1F",
            resetPassword: "\u91CD\u7F6E\u5BC6\u7801",
            pleaseInput: "\u8BF7\u8F93\u5165\u5B8C\u6574\u4FE1\u606F",
            createUser: "\u521B\u5EFA\u7528\u6237",
            email: "\u90AE\u7BB1",
            password: "\u5BC6\u7801",
            changeRole: "\u66F4\u6539\u89D2\u8272",
            prefix: "\u524D\u7F00",
            domains: "\u57DF\u540D",
            roleDonotExist: "\u5F53\u524D\u89D2\u8272\u4E0D\u5B58\u5728",
            userAddressManagement: "\u5730\u5740\u7BA1\u7406"
          }
        }
      }), v = f([]), p = f(0), s = f(1), b = f(20), y = f(""), i = f(false), c = f(""), x = f(false), w = f(0), U = f(false), u = f({
        email: "",
        password: ""
      }), g = f(false), A = f(false), z = f([]), j = f(""), T = ke(() => z.value.map((C) => ({
        label: C.role,
        value: C.role
      }))), S = async () => {
        try {
          const C = await P.fetch("/admin/user_roles");
          z.value = C;
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, I = async () => {
        try {
          y.value = y.value.trim();
          const { results: C, count: E } = await P.fetch(`/admin/users?limit=${b.value}&offset=${(s.value - 1) * b.value}` + (y.value ? `&query=${y.value}` : ""));
          v.value = C, E > 0 && (p.value = E);
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, F = async () => {
        if (!c.value) {
          l.error(n("pleaseInput"));
          return;
        }
        try {
          await P.fetch(`/admin/users/${w.value}/reset_password`, {
            method: "POST",
            body: JSON.stringify({
              password: await vt(c.value)
            })
          }), l.success(n("success")), i.value = false;
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, W = async () => {
        if (!u.value.email || !u.value.password) {
          l.error(n("pleaseInput"));
          return;
        }
        try {
          await P.fetch("/admin/users", {
            method: "POST",
            body: JSON.stringify({
              email: u.value.email,
              password: await vt(u.value.password)
            })
          }), l.success(n("success")), await I(), U.value = false;
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, k = async () => {
        try {
          await P.fetch(`/admin/users/${w.value}`, {
            method: "DELETE"
          }), l.success(n("success")), x.value = false;
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, $ = async () => {
        try {
          await P.fetch("/admin/user_roles", {
            method: "POST",
            body: JSON.stringify({
              user_id: w.value,
              role_text: j.value
            })
          }), l.success(n("success")), g.value = false, await I();
        } catch (C) {
          console.log(C), l.error(C.message || "error");
        }
      }, B = [
        {
          title: "ID",
          key: "id"
        },
        {
          title: n("user_email"),
          key: "user_email"
        },
        {
          title: n("role"),
          key: "role_text",
          render(C) {
            return C.role_text ? L(rt, {
              bordered: false,
              type: "info"
            }, {
              default: () => C.role_text
            }) : null;
          }
        },
        {
          title: n("address_count"),
          key: "address_count",
          render(C) {
            return L(O, {
              text: true,
              onClick: () => {
                C.address_count <= 0 || (w.value = C.id, A.value = true);
              }
            }, {
              icon: () => L(He, {
                value: C.address_count,
                "show-zero": true,
                max: 99,
                type: "success"
              }),
              default: () => C.address_count > 0 ? n("userAddressManagement") : ""
            });
          }
        },
        {
          title: n("created_at"),
          key: "created_at"
        },
        {
          title: n("actions"),
          key: "actions",
          render(C) {
            return L("div", [
              L(Mt, {
                mode: "horizontal",
                options: [
                  {
                    label: n("actions"),
                    icon: () => L(Tt),
                    key: "action",
                    children: [
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            w.value = C.id, A.value = true;
                          }
                        }, {
                          default: () => n("userAddressManagement")
                        }),
                        show: C.address_count > 0
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            w.value = C.id, j.value = C.role_text, g.value = true;
                          }
                        }, {
                          default: () => n("changeRole")
                        })
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            w.value = C.id, c.value = "", i.value = true;
                          }
                        }, {
                          default: () => n("resetPassword")
                        })
                      },
                      {
                        label: () => L(O, {
                          text: true,
                          onClick: () => {
                            w.value = C.id, u.value.email = "", u.value.password = "", x.value = true;
                          }
                        }, {
                          default: () => n("delete")
                        })
                      }
                    ]
                  }
                ]
              })
            ]);
          }
        }
      ], Y = (C) => {
        var _a2;
        const E = (_a2 = z.value.find((N) => N.role === C)) == null ? void 0 : _a2.prefix;
        return E ?? r.value.prefix;
      }, oe = (C) => {
        var _a2;
        const E = (_a2 = z.value.find((N) => N.role === C)) == null ? void 0 : _a2.domains;
        return E == null || E.length == 0 ? r.value.defaultDomains : E;
      }, ce = ke(() => j.value && !z.value.some((C) => C.role === j.value));
      return Ye([
        s,
        b
      ], async () => {
        await I();
      }), ae(async () => {
        await S(), await I();
      }), (C, E) => {
        const N = de, pe = ge, Q = et, me = Pe, Ue = Se, Fe = se, he = xe, ye = st, ne = Ne;
        return R(), J("div", al, [
          e(me, {
            show: U.value,
            "onUpdate:show": E[2] || (E[2] = (G) => U.value = G),
            preset: "dialog",
            title: a(n)("createUser")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: W,
                size: "small",
                tertiary: "",
                type: "primary"
              }, {
                default: t(() => [
                  _(o(a(n)("createUser")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              e(Q, null, {
                default: t(() => [
                  e(pe, {
                    label: a(n)("email"),
                    required: ""
                  }, {
                    default: t(() => [
                      e(N, {
                        value: u.value.email,
                        "onUpdate:value": E[0] || (E[0] = (G) => u.value.email = G)
                      }, null, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(pe, {
                    label: a(n)("password"),
                    required: ""
                  }, {
                    default: t(() => [
                      e(N, {
                        value: u.value.password,
                        "onUpdate:value": E[1] || (E[1] = (G) => u.value.password = G),
                        type: "password",
                        "show-password-on": "click"
                      }, null, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(me, {
            show: i.value,
            "onUpdate:show": E[4] || (E[4] = (G) => i.value = G),
            preset: "dialog",
            title: a(n)("resetPassword")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: F,
                size: "small",
                tertiary: "",
                type: "primary"
              }, {
                default: t(() => [
                  _(o(a(n)("resetPassword")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              e(pe, {
                label: a(n)("password"),
                required: ""
              }, {
                default: t(() => [
                  e(N, {
                    value: c.value,
                    "onUpdate:value": E[3] || (E[3] = (G) => c.value = G),
                    type: "password",
                    "show-password-on": "click"
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ])
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(me, {
            show: x.value,
            "onUpdate:show": E[5] || (E[5] = (G) => x.value = G),
            preset: "dialog",
            title: a(n)("deleteUser")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: k,
                size: "small",
                tertiary: "",
                type: "error"
              }, {
                default: t(() => [
                  _(o(a(n)("deleteUser")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(n)("deleteUserTip")), 1)
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(me, {
            show: g.value,
            "onUpdate:show": E[7] || (E[7] = (G) => g.value = G),
            preset: "dialog",
            title: a(n)("changeRole")
          }, {
            action: t(() => [
              e(a(O), {
                loading: a(d),
                onClick: $,
                size: "small",
                tertiary: "",
                type: "primary"
              }, {
                default: t(() => [
                  _(o(a(n)("changeRole")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              ce.value ? (R(), X(Ue, {
                key: 0,
                type: "error",
                bordered: false
              }, {
                default: t(() => [
                  M("span", null, o(a(n)("roleDonotExist")), 1)
                ]),
                _: 1
              })) : le("", true),
              M("p", null, o(a(n)("prefix") + ": " + Y(j.value)), 1),
              M("p", null, o(a(n)("domains") + ": " + JSON.stringify(oe(j.value))), 1),
              e(Fe, {
                clearable: "",
                value: j.value,
                "onUpdate:value": E[6] || (E[6] = (G) => j.value = G),
                options: T.value
              }, null, 8, [
                "value",
                "options"
              ])
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(me, {
            show: A.value,
            "onUpdate:show": E[8] || (E[8] = (G) => A.value = G),
            preset: "card",
            title: a(n)("userAddressManagement")
          }, {
            default: t(() => [
              e(tl, {
                user_id: w.value
              }, null, 8, [
                "user_id"
              ])
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(he, null, {
            default: t(() => [
              e(N, {
                value: y.value,
                "onUpdate:value": E[9] || (E[9] = (G) => y.value = G),
                onKeydown: Ge(I, [
                  "enter"
                ])
              }, null, 8, [
                "value"
              ]),
              e(a(O), {
                onClick: I,
                type: "primary",
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(n)("query")), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          M("div", ll, [
            M("div", nl, [
              e(ye, {
                page: s.value,
                "onUpdate:page": E[11] || (E[11] = (G) => s.value = G),
                "page-size": b.value,
                "onUpdate:pageSize": E[12] || (E[12] = (G) => b.value = G),
                "item-count": p.value,
                "page-sizes": [
                  20,
                  50,
                  100
                ],
                "show-size-picker": ""
              }, {
                prefix: t(({ itemCount: G }) => [
                  _(o(a(n)("itemCount")) + ": " + o(G), 1)
                ]),
                suffix: t(() => [
                  e(a(O), {
                    onClick: E[10] || (E[10] = (G) => U.value = true),
                    size: "small",
                    tertiary: "",
                    type: "primary",
                    style: {
                      "margin-left": "10px"
                    }
                  }, {
                    default: t(() => [
                      _(o(a(n)("createUser")), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "page",
                "page-size",
                "item-count"
              ])
            ]),
            e(ne, {
              columns: B,
              data: v.value,
              bordered: false,
              embedded: ""
            }, null, 8, [
              "data"
            ])
          ])
        ]);
      };
    }
  };
  ol = Z(sl, [
    [
      "__scopeId",
      "data-v-9bf893ed"
    ]
  ]);
  rl = {
    class: "center"
  };
  il = {
    __name: "UserSettings",
    setup(m) {
      const { loading: d } = ie(), r = te(), { t: l } = ee({
        messages: {
          en: {
            save: "Save",
            successTip: "Save Success",
            enable: "Enable",
            enableUserRegister: "Allow User Register",
            enableMailVerify: "Enable Mail Verify (Send address must be an address in the system with a balance and can send mail normally)",
            verifyMailSender: "Verify Mail Sender",
            enableMailAllowList: "Enable Mail Address Allow List(Manually enterable)",
            manualInputPrompt: "Type and press Enter to add",
            mailAllowList: "Mail Address Allow List",
            maxAddressCount: "Maximum number of email addresses that can be binded"
          },
          zh: {
            save: "\u4FDD\u5B58",
            successTip: "\u4FDD\u5B58\u6210\u529F",
            enable: "\u542F\u7528",
            enableUserRegister: "\u5141\u8BB8\u7528\u6237\u6CE8\u518C",
            enableMailVerify: "\u542F\u7528\u90AE\u4EF6\u9A8C\u8BC1(\u53D1\u9001\u5730\u5740\u5FC5\u987B\u662F\u7CFB\u7EDF\u4E2D\u80FD\u6709\u4F59\u989D\u4E14\u80FD\u6B63\u5E38\u53D1\u9001\u90AE\u4EF6\u7684\u5730\u5740)",
            verifyMailSender: "\u9A8C\u8BC1\u90AE\u4EF6\u53D1\u9001\u5730\u5740",
            enableMailAllowList: "\u542F\u7528\u90AE\u4EF6\u5730\u5740\u767D\u540D\u5355(\u53EF\u624B\u52A8\u8F93\u5165, \u56DE\u8F66\u589E\u52A0)",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            mailAllowList: "\u90AE\u4EF6\u5730\u5740\u767D\u540D\u5355",
            maxAddressCount: "\u53EF\u7ED1\u5B9A\u6700\u5927\u90AE\u7BB1\u5730\u5740\u6570\u91CF"
          }
        }
      }), n = [
        "gmail.com",
        "163.com",
        "126.com",
        "qq.com",
        "outlook.com",
        "hotmail.com",
        "icloud.com",
        "yahoo.com",
        "foxmail.com"
      ], v = n.map((y) => ({
        label: y,
        value: y
      })), p = f({
        enable: false,
        enableMailVerify: false,
        verifyMailSender: "",
        enableMailAllowList: false,
        mailAllowList: n,
        maxAddressCount: 5
      }), s = async () => {
        try {
          const y = await P.fetch("/admin/user_settings");
          Object.assign(p.value, y);
        } catch (y) {
          r.error(y.message || "error");
        }
      }, b = async () => {
        try {
          await P.fetch("/admin/user_settings", {
            method: "POST",
            body: JSON.stringify(p.value)
          }), r.success(l("successTip"));
        } catch (y) {
          r.error(y.message || "error");
        }
      };
      return ae(async () => {
        await s();
      }), (y, i) => {
        const c = O, x = De, w = Ve, U = ge, u = Ke, g = de, A = xe, z = Le, j = se, T = Je, S = et, I = ue;
        return R(), J("div", rl, [
          e(I, {
            bordered: false,
            embedded: "",
            style: {
              "max-width": "600px"
            }
          }, {
            default: t(() => [
              e(x, {
                justify: "end"
              }, {
                default: t(() => [
                  e(c, {
                    onClick: b,
                    type: "primary",
                    loading: a(d)
                  }, {
                    default: t(() => [
                      _(o(a(l)("save")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ])
                ]),
                _: 1
              }),
              e(S, {
                model: p.value
              }, {
                default: t(() => [
                  e(U, {
                    label: a(l)("enableUserRegister")
                  }, {
                    default: t(() => [
                      e(w, {
                        value: p.value.enable,
                        "onUpdate:value": i[0] || (i[0] = (F) => p.value.enable = F),
                        round: false
                      }, null, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(U, {
                    label: a(l)("enableMailVerify")
                  }, {
                    default: t(() => [
                      e(A, null, {
                        default: t(() => [
                          e(u, {
                            checked: p.value.enableMailVerify,
                            "onUpdate:checked": i[1] || (i[1] = (F) => p.value.enableMailVerify = F),
                            style: {
                              width: "20%"
                            }
                          }, {
                            default: t(() => [
                              _(o(a(l)("enable")), 1)
                            ]),
                            _: 1
                          }, 8, [
                            "checked"
                          ]),
                          p.value.enableMailVerify ? (R(), X(g, {
                            key: 0,
                            value: p.value.verifyMailSender,
                            "onUpdate:value": i[2] || (i[2] = (F) => p.value.verifyMailSender = F),
                            style: {
                              width: "80%"
                            },
                            placeholder: a(l)("verifyMailSender")
                          }, null, 8, [
                            "value",
                            "placeholder"
                          ])) : le("", true)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(U, {
                    label: a(l)("enableMailAllowList")
                  }, {
                    default: t(() => [
                      e(A, null, {
                        default: t(() => [
                          e(u, {
                            checked: p.value.enableMailAllowList,
                            "onUpdate:checked": i[3] || (i[3] = (F) => p.value.enableMailAllowList = F),
                            style: {
                              width: "20%"
                            }
                          }, {
                            default: t(() => [
                              _(o(a(l)("enable")), 1)
                            ]),
                            _: 1
                          }, 8, [
                            "checked"
                          ]),
                          p.value.enableMailAllowList ? (R(), X(j, {
                            key: 0,
                            value: p.value.mailAllowList,
                            "onUpdate:value": i[4] || (i[4] = (F) => p.value.mailAllowList = F),
                            filterable: "",
                            multiple: "",
                            tag: "",
                            style: {
                              width: "80%"
                            },
                            options: a(v),
                            placeholder: a(l)("mailAllowList")
                          }, {
                            empty: t(() => [
                              e(z, {
                                depth: "3"
                              }, {
                                default: t(() => [
                                  _(o(a(l)("manualInputPrompt")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "value",
                            "options",
                            "placeholder"
                          ])) : le("", true)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(U, {
                    label: a(l)("maxAddressCount")
                  }, {
                    default: t(() => [
                      e(A, null, {
                        default: t(() => [
                          e(T, {
                            value: p.value.maxAddressCount,
                            "onUpdate:value": i[5] || (i[5] = (F) => p.value.maxAddressCount = F),
                            placeholder: a(l)("maxAddressCount")
                          }, null, 8, [
                            "value",
                            "placeholder"
                          ])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ])
                ]),
                _: 1
              }, 8, [
                "model"
              ])
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  kt = Z(il, [
    [
      "__scopeId",
      "data-v-97bafb47"
    ]
  ]);
  ul = [
    "gmail.com",
    "163.com",
    "126.com",
    "qq.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "yahoo.com",
    "foxmail.com"
  ];
  xt = {
    COMMOM_MAIL: ul
  };
  dl = {
    class: "center"
  };
  cl = re({
    __name: "UserOauth2Settings",
    setup(m) {
      const { loading: d } = ie(), r = te(), { t: l } = ee({
        messages: {
          en: {
            save: "Save",
            delete: "Delete",
            successTip: "Save Success",
            enable: "Enable",
            enableMailAllowList: "Enable Mail Address Allow List(Manually enterable)",
            manualInputPrompt: "Type and press Enter to add",
            mailAllowList: "Mail Address Allow List",
            addOauth2: "Add Oauth2",
            name: "Name",
            oauth2Type: "Oauth2 Type",
            tip: "Third-party login will automatically use the user's email to register an account (the same email will be regarded as the same account), this account is the same as the registered account, and you can also set the password through the forget password"
          },
          zh: {
            save: "\u4FDD\u5B58",
            delete: "\u5220\u9664",
            successTip: "\u4FDD\u5B58\u6210\u529F",
            enable: "\u542F\u7528",
            enableMailAllowList: "\u542F\u7528\u90AE\u4EF6\u5730\u5740\u767D\u540D\u5355(\u53EF\u624B\u52A8\u8F93\u5165, \u56DE\u8F66\u589E\u52A0)",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            mailAllowList: "\u90AE\u4EF6\u5730\u5740\u767D\u540D\u5355",
            addOauth2: "\u6DFB\u52A0 Oauth2",
            name: "\u540D\u79F0",
            oauth2Type: "Oauth2 \u7C7B\u578B",
            tip: "\u7B2C\u4E09\u65B9\u767B\u5F55\u4F1A\u81EA\u52A8\u4F7F\u7528\u7528\u6237\u90AE\u7BB1\u6CE8\u518C\u8D26\u53F7(\u90AE\u7BB1\u76F8\u540C\u5C06\u89C6\u4E3A\u540C\u4E00\u8D26\u53F7), \u6B64\u8D26\u53F7\u548C\u6CE8\u518C\u7684\u8D26\u53F7\u76F8\u540C, \u4E5F\u53EF\u4EE5\u901A\u8FC7\u5FD8\u8BB0\u5BC6\u7801\u8BBE\u7F6E\u5BC6\u7801"
          }
        }
      }), n = xt.COMMOM_MAIL.map((w) => ({
        label: w,
        value: w
      })), v = f([]), p = f(false), s = f(""), b = f("custom"), y = async () => {
        try {
          const w = await P.fetch("/admin/user_oauth2_settings");
          Object.assign(v.value, w);
        } catch (w) {
          r.error(w.message || "error");
        }
      }, i = async () => {
        try {
          await P.fetch("/admin/user_oauth2_settings", {
            method: "POST",
            body: JSON.stringify(v.value)
          }), r.success(l("successTip"));
        } catch (w) {
          r.error(w.message || "error");
        }
      }, c = () => {
        const w = () => {
          switch (b.value) {
            case "github":
              return "https://github.com/login/oauth/authorize";
            case "authentik":
              return "https://youdomain/application/o/authorize/";
            default:
              return "";
          }
        }, U = () => {
          switch (b.value) {
            case "github":
              return "https://github.com/login/oauth/access_token";
            case "authentik":
              return "https://youdomain/application/o/token/";
            default:
              return "";
          }
        }, u = () => {
          switch (b.value) {
            case "github":
              return "json";
            case "authentik":
              return "urlencoded";
            default:
              return "";
          }
        }, g = () => {
          switch (b.value) {
            case "github":
              return "https://api.github.com/user";
            case "authentik":
              return "https://youdomain/application/o/userinfo/";
            default:
              return "";
          }
        }, A = () => {
          switch (b.value) {
            case "github":
              return "email";
            case "authentik":
              return "email";
            default:
              return "";
          }
        }, z = () => {
          switch (b.value) {
            case "github":
              return "user:email";
            case "authentik":
              return "email openid";
            default:
              return "";
          }
        };
        v.value.push({
          name: s.value,
          clientID: "",
          clientSecret: "",
          authorizationURL: w(),
          accessTokenURL: U(),
          accessTokenFormat: u(),
          userInfoURL: g(),
          userEmailKey: A(),
          redirectURL: `${window.location.origin}/user/oauth2/callback`,
          logoutURL: "",
          scope: z(),
          enableMailAllowList: false,
          mailAllowList: xt.COMMOM_MAIL
        }), s.value = "", p.value = false;
      }, x = [
        {
          label: "json",
          value: "json"
        },
        {
          label: "urlencoded",
          value: "urlencoded"
        }
      ];
      return ae(async () => {
        await y();
      }), (w, U) => {
        const u = de, g = ge, A = na, z = Et, j = et, T = O, S = Pe, I = Se, F = De, W = ut, k = Ze, $ = se, B = Ke, Y = Le, oe = xe, ce = Dt, C = Pt, E = ue;
        return R(), J("div", dl, [
          e(S, {
            show: p.value,
            "onUpdate:show": U[2] || (U[2] = (N) => p.value = N),
            preset: "dialog",
            title: a(l)("addOauth2")
          }, {
            action: t(() => [
              e(T, {
                loading: a(d),
                onClick: c,
                size: "small",
                tertiary: "",
                type: "primary"
              }, {
                default: t(() => [
                  _(o(a(l)("addOauth2")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              e(j, null, {
                default: t(() => [
                  e(g, {
                    label: a(l)("name"),
                    required: ""
                  }, {
                    default: t(() => [
                      e(u, {
                        value: s.value,
                        "onUpdate:value": U[0] || (U[0] = (N) => s.value = N)
                      }, null, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(g, {
                    label: a(l)("oauth2Type"),
                    required: ""
                  }, {
                    default: t(() => [
                      e(z, {
                        value: b.value,
                        "onUpdate:value": U[1] || (U[1] = (N) => b.value = N)
                      }, {
                        default: t(() => [
                          e(A, {
                            value: "github",
                            label: "Github"
                          }),
                          e(A, {
                            value: "authentik",
                            label: "Authentik"
                          }),
                          e(A, {
                            value: "custom",
                            label: "Custom"
                          })
                        ]),
                        _: 1
                      }, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          e(E, {
            bordered: false,
            embedded: "",
            style: {
              "max-width": "600px"
            }
          }, {
            default: t(() => [
              e(I, {
                "show-icon": false,
                bordered: false,
                type: "warning",
                closable: "",
                style: {
                  "margin-bottom": "10px"
                }
              }, {
                default: t(() => [
                  _(o(a(l)("tip")), 1)
                ]),
                _: 1
              }),
              e(F, {
                justify: "end"
              }, {
                default: t(() => [
                  e(T, {
                    onClick: U[3] || (U[3] = (N) => p.value = true),
                    secondary: "",
                    loading: a(d)
                  }, {
                    default: t(() => [
                      _(o(a(l)("addOauth2")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ]),
                  e(T, {
                    onClick: i,
                    type: "primary",
                    loading: a(d)
                  }, {
                    default: t(() => [
                      _(o(a(l)("save")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ])
                ]),
                _: 1
              }),
              e(W),
              e(C, {
                "default-expanded-names": "1",
                accordion: "",
                "trigger-areas": [
                  "main",
                  "arrow"
                ]
              }, {
                default: t(() => [
                  (R(true), J(it, null, $t(v.value, (N, pe) => (R(), X(ce, {
                    key: pe,
                    title: N.name
                  }, {
                    "header-extra": t(() => [
                      e(k, {
                        onPositiveClick: (Q) => v.value.splice(pe, 1)
                      }, {
                        trigger: t(() => [
                          e(T, {
                            tertiary: "",
                            type: "error"
                          }, {
                            default: t(() => [
                              _(o(a(l)("delete")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        default: t(() => [
                          _(" " + o(a(l)("delete")), 1)
                        ]),
                        _: 1
                      }, 8, [
                        "onPositiveClick"
                      ])
                    ]),
                    default: t(() => [
                      e(j, {
                        model: N
                      }, {
                        default: t(() => [
                          e(g, {
                            label: a(l)("name"),
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.name,
                                "onUpdate:value": (Q) => N.name = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1032, [
                            "label"
                          ]),
                          e(g, {
                            label: "Client ID",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.clientID,
                                "onUpdate:value": (Q) => N.clientID = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Client Secret",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.clientSecret,
                                "onUpdate:value": (Q) => N.clientSecret = Q,
                                type: "password",
                                "show-password-on": "click"
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Authorization URL",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.authorizationURL,
                                "onUpdate:value": (Q) => N.authorizationURL = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Access Token URL",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.accessTokenURL,
                                "onUpdate:value": (Q) => N.accessTokenURL = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Access Token Params Format",
                            required: ""
                          }, {
                            default: t(() => [
                              e($, {
                                value: N.accessTokenFormat,
                                "onUpdate:value": (Q) => N.accessTokenFormat = Q,
                                options: x
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "User Info URL",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.userInfoURL,
                                "onUpdate:value": (Q) => N.userInfoURL = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "User Email Key (Support JSONPATH like $[0].email)",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.userEmailKey,
                                "onUpdate:value": (Q) => N.userEmailKey = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Redirect URL",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.redirectURL,
                                "onUpdate:value": (Q) => N.redirectURL = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: "Scope",
                            required: ""
                          }, {
                            default: t(() => [
                              e(u, {
                                value: N.scope,
                                "onUpdate:value": (Q) => N.scope = Q
                              }, null, 8, [
                                "value",
                                "onUpdate:value"
                              ])
                            ]),
                            _: 2
                          }, 1024),
                          e(g, {
                            label: a(l)("enableMailAllowList")
                          }, {
                            default: t(() => [
                              e(oe, null, {
                                default: t(() => [
                                  e(B, {
                                    checked: N.enableMailAllowList,
                                    "onUpdate:checked": (Q) => N.enableMailAllowList = Q,
                                    style: {
                                      width: "20%"
                                    }
                                  }, {
                                    default: t(() => [
                                      _(o(a(l)("enable")), 1)
                                    ]),
                                    _: 1
                                  }, 8, [
                                    "checked",
                                    "onUpdate:checked"
                                  ]),
                                  N.enableMailAllowList ? (R(), X($, {
                                    key: 0,
                                    value: N.mailAllowList,
                                    "onUpdate:value": (Q) => N.mailAllowList = Q,
                                    filterable: "",
                                    multiple: "",
                                    tag: "",
                                    style: {
                                      width: "80%"
                                    },
                                    options: a(n),
                                    placeholder: a(l)("mailAllowList")
                                  }, {
                                    empty: t(() => [
                                      e(Y, {
                                        depth: "3"
                                      }, {
                                        default: t(() => [
                                          _(o(a(l)("manualInputPrompt")), 1)
                                        ]),
                                        _: 1
                                      })
                                    ]),
                                    _: 1
                                  }, 8, [
                                    "value",
                                    "onUpdate:value",
                                    "options",
                                    "placeholder"
                                  ])) : le("", true)
                                ]),
                                _: 2
                              }, 1024)
                            ]),
                            _: 2
                          }, 1032, [
                            "label"
                          ])
                        ]),
                        _: 2
                      }, 1032, [
                        "model"
                      ])
                    ]),
                    _: 2
                  }, 1032, [
                    "title"
                  ]))), 128))
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]);
      };
    }
  });
  pl = Z(cl, [
    [
      "__scopeId",
      "data-v-bf5fab57"
    ]
  ]);
  ml = {
    style: {
      "margin-top": "10px"
    }
  };
  _l = {
    key: 1
  };
  fl = {
    __name: "RoleAddressConfig",
    setup(m) {
      const { loading: d } = ie(), r = te(), { t: l } = ee({
        messages: {
          en: {
            role: "Role",
            maxAddressCount: "Max Address Count",
            save: "Save",
            successTip: "Success",
            noRolesAvailable: "No roles available in system config",
            roleConfigDesc: "Configure maximum address count for each user role. Role-based limits take priority over global settings.",
            notConfigured: "Not Configured (Use Global Settings)"
          },
          zh: {
            role: "\u89D2\u8272",
            maxAddressCount: "\u6700\u5927\u5730\u5740\u6570\u91CF",
            save: "\u4FDD\u5B58",
            successTip: "\u6210\u529F",
            noRolesAvailable: "\u7CFB\u7EDF\u914D\u7F6E\u4E2D\u6CA1\u6709\u53EF\u7528\u7684\u89D2\u8272",
            roleConfigDesc: "\u4E3A\u6BCF\u4E2A\u7528\u6237\u89D2\u8272\u914D\u7F6E\u6700\u5927\u5730\u5740\u6570\u91CF\u3002\u89D2\u8272\u914D\u7F6E\u4F18\u5148\u4E8E\u5168\u5C40\u8BBE\u7F6E\u3002",
            notConfigured: "\u672A\u914D\u7F6E\uFF08\u4F7F\u7528\u5168\u5C40\u8BBE\u7F6E\uFF09"
          }
        }
      }), n = f([]), v = f([]), p = async () => {
        try {
          const i = await P.fetch("/admin/user_roles");
          n.value = i;
        } catch (i) {
          console.log(i), r.error(i.message || "error");
        }
      }, s = async () => {
        try {
          const { configs: i } = await P.fetch("/admin/role_address_config");
          v.value = n.value.map((c) => {
            var _a2;
            return {
              role: c.role,
              max_address_count: ((_a2 = i[c.role]) == null ? void 0 : _a2.maxAddressCount) ?? null
            };
          });
        } catch (i) {
          console.log(i), r.error(i.message || "error");
        }
      }, b = async () => {
        try {
          const i = {};
          v.value.forEach((c) => {
            c.max_address_count !== null && c.max_address_count !== void 0 && (i[c.role] = {
              maxAddressCount: c.max_address_count
            });
          }), await P.fetch("/admin/role_address_config", {
            method: "POST",
            body: JSON.stringify({
              configs: i
            })
          }), r.success(l("successTip")), await s();
        } catch (i) {
          console.log(i), r.error(i.message || "error");
        }
      }, y = [
        {
          title: l("role"),
          key: "role",
          width: 200,
          render(i) {
            return L(rt, {
              type: "info",
              bordered: false
            }, {
              default: () => i.role
            });
          }
        },
        {
          title: l("maxAddressCount"),
          key: "max_address_count",
          render(i) {
            return L(Je, {
              value: i.max_address_count,
              min: 0,
              max: 999,
              clearable: true,
              placeholder: l("notConfigured"),
              style: "width: 200px;",
              onUpdateValue: (c) => {
                i.max_address_count = c;
              }
            });
          }
        }
      ];
      return ae(async () => {
        await p(), await s();
      }), (i, c) => {
        const x = Se, w = Ne;
        return R(), J("div", ml, [
          e(x, {
            type: "info",
            bordered: false,
            style: {
              "margin-bottom": "20px"
            }
          }, {
            default: t(() => [
              _(o(a(l)("roleConfigDesc")), 1)
            ]),
            _: 1
          }),
          n.value.length === 0 ? (R(), X(x, {
            key: 0,
            type: "warning",
            bordered: false
          }, {
            default: t(() => [
              _(o(a(l)("noRolesAvailable")), 1)
            ]),
            _: 1
          })) : (R(), J("div", _l, [
            e(a(qe), {
              justify: "end",
              style: {
                "margin-bottom": "12px"
              }
            }, {
              default: t(() => [
                e(a(O), {
                  loading: a(d),
                  onClick: b,
                  type: "primary"
                }, {
                  default: t(() => [
                    _(o(a(l)("save")), 1)
                  ]),
                  _: 1
                }, 8, [
                  "loading"
                ])
              ]),
              _: 1
            }),
            e(w, {
              columns: y,
              data: v.value,
              bordered: false,
              embedded: ""
            }, null, 8, [
              "data"
            ])
          ]))
        ]);
      };
    }
  };
  vl = Z(fl, [
    [
      "__scopeId",
      "data-v-68eee4b7"
    ]
  ]);
  bl = {
    style: {
      "margin-top": "10px"
    }
  };
  gl = {
    __name: "Mails",
    setup(m) {
      const { adminMailTabAddress: d } = ie(), { t: r } = ee({
        messages: {
          en: {
            addressQueryTip: "Leave blank to query all addresses",
            query: "Query"
          },
          zh: {
            addressQueryTip: "\u7559\u7A7A\u67E5\u8BE2\u6240\u6709\u5730\u5740",
            query: "\u67E5\u8BE2"
          }
        }
      }), l = f(""), n = () => {
        d.value = d.value.trim(), l.value = Date.now();
      }, v = async (s, b) => await P.fetch(`/admin/mails?limit=${s}&offset=${b}` + (d.value ? `&address=${d.value}` : "")), p = async (s) => {
        await P.fetch(`/admin/mails/${s}`, {
          method: "DELETE"
        });
      };
      return (s, b) => {
        const y = de, i = O, c = xe;
        return R(), J("div", bl, [
          e(c, null, {
            default: t(() => [
              e(y, {
                value: a(d),
                "onUpdate:value": b[0] || (b[0] = (x) => ot(d) ? d.value = x : null),
                placeholder: a(r)("addressQueryTip"),
                onKeydown: Ge(n, [
                  "enter"
                ]),
                clearable: ""
              }, null, 8, [
                "value",
                "placeholder"
              ]),
              e(i, {
                onClick: n,
                type: "primary",
                tertiary: ""
              }, {
                default: t(() => [
                  _(o(a(r)("query")), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          b[1] || (b[1] = M("div", {
            style: {
              "margin-top": "10px"
            }
          }, null, -1)),
          (R(), X(Rt, {
            key: l.value,
            enableUserDeleteEmail: true,
            fetchMailData: v,
            deleteMail: p,
            showFilterInput: true
          }))
        ]);
      };
    }
  };
  hl = {
    style: {
      "margin-top": "10px"
    }
  };
  yl = {
    __name: "MailsUnknow",
    setup(m) {
      const d = async (l, n) => await P.fetch(`/admin/mails_unknow?limit=${l}&offset=${n}`), r = async (l) => {
        await P.fetch(`/admin/mails/${l}`, {
          method: "DELETE"
        });
      };
      return (l, n) => (R(), J("div", hl, [
        e(Rt, {
          enableUserDeleteEmail: true,
          fetchMailData: d,
          deleteMail: r
        })
      ]));
    }
  };
  wl = {
    class: "center"
  };
  kl = {
    __name: "Maintenance",
    setup(m) {
      const { loading: d } = ie(), r = te(), l = f({
        enableMailsAutoCleanup: false,
        cleanMailsDays: 30,
        enableUnknowMailsAutoCleanup: false,
        cleanUnknowMailsDays: 30,
        enableSendBoxAutoCleanup: false,
        cleanSendBoxDays: 30,
        enableAddressAutoCleanup: false,
        cleanAddressDays: 30,
        enableInactiveAddressAutoCleanup: false,
        cleanInactiveAddressDays: 30,
        enableUnboundAddressAutoCleanup: false,
        cleanUnboundAddressDays: 30,
        enableEmptyAddressAutoCleanup: false,
        cleanEmptyAddressDays: 30,
        customSqlCleanupList: []
      }), { t: n } = ee({
        messages: {
          en: {
            tip: "Please input the days",
            mailBoxLabel: "Cleanup the inbox before n days",
            mailUnknowLabel: "Cleanup the unknow mail before n days",
            sendBoxLabel: "Cleanup the sendbox before n days",
            addressCreateLabel: "Cleanup the address created before n days",
            inactiveAddressLabel: "Cleanup the inactive address before n days",
            unboundAddressLabel: "Cleanup the unbound address before n days",
            emptyAddressLabel: "Cleanup the empty address before n days",
            cleanupNow: "Cleanup now",
            autoCleanup: "Auto cleanup",
            cleanupSuccess: "Cleanup success",
            saveSuccess: "Save success",
            save: "Save",
            cronTip: "Enable cron cleanup, need to configure [crons] in worker, please refer to the document, setting 0 days means clear all",
            basicCleanup: "Basic Cleanup",
            customSqlCleanup: "Custom SQL Cleanup",
            customSqlTip: "Add custom DELETE SQL statements for scheduled cleanup. Only single DELETE statement is allowed per entry.",
            addCustomSql: "Add Custom SQL",
            sqlName: "Name",
            sqlStatement: "SQL Statement (DELETE only)",
            sqlNamePlaceholder: "e.g. Clean old logs",
            sqlPlaceholder: "e.g. DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')",
            deleteCustomSql: "Delete"
          },
          zh: {
            tip: "\u8BF7\u8F93\u5165\u5929\u6570",
            mailBoxLabel: "\u6E05\u7406 n \u5929\u524D\u7684\u6536\u4EF6\u7BB1",
            mailUnknowLabel: "\u6E05\u7406 n \u5929\u524D\u7684\u65E0\u6536\u4EF6\u4EBA\u90AE\u4EF6",
            sendBoxLabel: "\u6E05\u7406 n \u5929\u524D\u7684\u53D1\u4EF6\u7BB1",
            addressCreateLabel: "\u6E05\u7406 n \u5929\u524D\u521B\u5EFA\u7684\u5730\u5740",
            inactiveAddressLabel: "\u6E05\u7406 n \u5929\u524D\u7684\u672A\u6D3B\u8DC3\u5730\u5740",
            unboundAddressLabel: "\u6E05\u7406 n \u5929\u524D\u7684\u672A\u7ED1\u5B9A\u7528\u6237\u5730\u5740",
            emptyAddressLabel: "\u6E05\u7406 n \u5929\u524D\u7A7A\u90AE\u4EF6\u7684\u90AE\u7BB1\u5730\u5740",
            autoCleanup: "\u81EA\u52A8\u6E05\u7406",
            cleanupSuccess: "\u6E05\u7406\u6210\u529F",
            saveSuccess: "\u4FDD\u5B58\u6210\u529F",
            cleanupNow: "\u7ACB\u5373\u6E05\u7406",
            save: "\u4FDD\u5B58",
            cronTip: "\u542F\u7528\u5B9A\u65F6\u6E05\u7406, \u9700\u5728 worker \u914D\u7F6E [crons] \u53C2\u6570, \u8BF7\u53C2\u8003\u6587\u6863, \u914D\u7F6E\u4E3A 0 \u5929\u8868\u793A\u5168\u90E8\u6E05\u7A7A",
            basicCleanup: "\u57FA\u7840\u6E05\u7406",
            customSqlCleanup: "\u81EA\u5B9A\u4E49 SQL \u6E05\u7406",
            customSqlTip: "\u6DFB\u52A0\u81EA\u5B9A\u4E49 DELETE SQL \u8BED\u53E5\u8FDB\u884C\u5B9A\u65F6\u6E05\u7406\u3002\u6BCF\u6761\u8BB0\u5F55\u4EC5\u5141\u8BB8\u5355\u6761 DELETE \u8BED\u53E5\u3002",
            addCustomSql: "\u6DFB\u52A0\u81EA\u5B9A\u4E49 SQL",
            sqlName: "\u540D\u79F0",
            sqlStatement: "SQL \u8BED\u53E5 (\u4EC5\u9650 DELETE)",
            sqlNamePlaceholder: "\u4F8B\u5982: \u6E05\u7406\u65E7\u65E5\u5FD7",
            sqlPlaceholder: "\u4F8B\u5982: DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')",
            deleteCustomSql: "\u5220\u9664"
          }
        }
      }), v = async (i, c) => {
        try {
          await P.fetch("/admin/cleanup", {
            method: "POST",
            body: JSON.stringify({
              cleanType: i,
              cleanDays: c
            })
          }), r.success(n("cleanupSuccess"));
        } catch (x) {
          r.error(x.message || "error");
        }
      }, p = () => {
        l.value.customSqlCleanupList || (l.value.customSqlCleanupList = []), l.value.customSqlCleanupList.push({
          id: Date.now().toString(),
          name: "",
          sql: "",
          enabled: false
        });
      }, s = (i) => {
        l.value.customSqlCleanupList.splice(i, 1);
      }, b = async () => {
        try {
          const i = await P.fetch("/admin/auto_cleanup");
          i && Object.assign(l.value, i), l.value.customSqlCleanupList || (l.value.customSqlCleanupList = []);
        } catch (i) {
          r.error(i.message || "error");
        }
      }, y = async () => {
        try {
          await P.fetch("/admin/auto_cleanup", {
            method: "POST",
            body: JSON.stringify(l.value)
          }), r.success(n("saveSuccess"));
        } catch (i) {
          r.error(i.message || "error");
        }
      };
      return ae(async () => {
        await b();
      }), (i, c) => {
        const x = Se, w = O, U = De, u = Ke, g = Je, A = It, z = ge, j = et, T = Ot, S = de, I = qe, F = ue, W = Bt;
        return R(), J("div", wl, [
          e(F, {
            bordered: false,
            embedded: ""
          }, {
            default: t(() => [
              e(x, {
                "show-icon": false,
                bordered: false,
                type: "warning"
              }, {
                default: t(() => [
                  M("span", null, o(a(n)("cronTip")), 1)
                ]),
                _: 1
              }),
              e(U, {
                justify: "end"
              }, {
                default: t(() => [
                  e(w, {
                    onClick: y,
                    type: "primary",
                    loading: a(d)
                  }, {
                    default: t(() => [
                      _(o(a(n)("save")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ])
                ]),
                _: 1
              }),
              e(W, {
                type: "segment",
                style: {
                  "margin-top": "16px"
                }
              }, {
                default: t(() => [
                  e(T, {
                    name: "basic",
                    tab: a(n)("basicCleanup")
                  }, {
                    default: t(() => [
                      e(j, {
                        model: l.value
                      }, {
                        default: t(() => [
                          e(z, {
                            label: a(n)("mailBoxLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableMailsAutoCleanup,
                                "onUpdate:checked": c[0] || (c[0] = (k) => l.value.enableMailsAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanMailsDays,
                                "onUpdate:value": c[1] || (c[1] = (k) => l.value.cleanMailsDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[2] || (c[2] = (k) => v("mails", l.value.cleanMailsDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("mailUnknowLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableUnknowMailsAutoCleanup,
                                "onUpdate:checked": c[3] || (c[3] = (k) => l.value.enableUnknowMailsAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanUnknowMailsDays,
                                "onUpdate:value": c[4] || (c[4] = (k) => l.value.cleanUnknowMailsDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[5] || (c[5] = (k) => v("mails_unknow", l.value.cleanUnknowMailsDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("sendBoxLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableSendBoxAutoCleanup,
                                "onUpdate:checked": c[6] || (c[6] = (k) => l.value.enableSendBoxAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanSendBoxDays,
                                "onUpdate:value": c[7] || (c[7] = (k) => l.value.cleanSendBoxDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[8] || (c[8] = (k) => v("sendbox", l.value.cleanSendBoxDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("addressCreateLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableAddressAutoCleanup,
                                "onUpdate:checked": c[9] || (c[9] = (k) => l.value.enableAddressAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanAddressDays,
                                "onUpdate:value": c[10] || (c[10] = (k) => l.value.cleanAddressDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[11] || (c[11] = (k) => v("addressCreated", l.value.cleanAddressDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("inactiveAddressLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableInactiveAddressAutoCleanup,
                                "onUpdate:checked": c[12] || (c[12] = (k) => l.value.enableInactiveAddressAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanInactiveAddressDays,
                                "onUpdate:value": c[13] || (c[13] = (k) => l.value.cleanInactiveAddressDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[14] || (c[14] = (k) => v("inactiveAddress", l.value.cleanInactiveAddressDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("unboundAddressLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableUnboundAddressAutoCleanup,
                                "onUpdate:checked": c[15] || (c[15] = (k) => l.value.enableUnboundAddressAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanUnboundAddressDays,
                                "onUpdate:value": c[16] || (c[16] = (k) => l.value.cleanUnboundAddressDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[17] || (c[17] = (k) => v("unboundAddress", l.value.cleanUnboundAddressDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ]),
                          e(z, {
                            label: a(n)("emptyAddressLabel")
                          }, {
                            default: t(() => [
                              e(u, {
                                checked: l.value.enableEmptyAddressAutoCleanup,
                                "onUpdate:checked": c[18] || (c[18] = (k) => l.value.enableEmptyAddressAutoCleanup = k)
                              }, {
                                default: t(() => [
                                  _(o(a(n)("autoCleanup")), 1)
                                ]),
                                _: 1
                              }, 8, [
                                "checked"
                              ]),
                              e(g, {
                                value: l.value.cleanEmptyAddressDays,
                                "onUpdate:value": c[19] || (c[19] = (k) => l.value.cleanEmptyAddressDays = k),
                                placeholder: a(n)("tip")
                              }, null, 8, [
                                "value",
                                "placeholder"
                              ]),
                              e(w, {
                                onClick: c[20] || (c[20] = (k) => v("emptyAddress", l.value.cleanEmptyAddressDays))
                              }, {
                                icon: t(() => [
                                  e(A, {
                                    component: a(Te)
                                  }, null, 8, [
                                    "component"
                                  ])
                                ]),
                                default: t(() => [
                                  _(" " + o(a(n)("cleanupNow")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "label"
                          ])
                        ]),
                        _: 1
                      }, 8, [
                        "model"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "tab"
                  ]),
                  e(T, {
                    name: "custom_sql",
                    tab: a(n)("customSqlCleanup")
                  }, {
                    default: t(() => [
                      e(x, {
                        "show-icon": false,
                        bordered: false,
                        type: "info",
                        style: {
                          "margin-bottom": "16px"
                        }
                      }, {
                        default: t(() => [
                          M("span", null, o(a(n)("customSqlTip")), 1)
                        ]),
                        _: 1
                      }),
                      e(I, {
                        vertical: ""
                      }, {
                        default: t(() => [
                          (R(true), J(it, null, $t(l.value.customSqlCleanupList, (k, $) => (R(), X(F, {
                            key: k.id,
                            size: "small"
                          }, {
                            default: t(() => [
                              e(I, {
                                vertical: ""
                              }, {
                                default: t(() => [
                                  e(I, {
                                    align: "center"
                                  }, {
                                    default: t(() => [
                                      e(u, {
                                        checked: k.enabled,
                                        "onUpdate:checked": (B) => k.enabled = B
                                      }, {
                                        default: t(() => [
                                          _(o(a(n)("autoCleanup")), 1)
                                        ]),
                                        _: 1
                                      }, 8, [
                                        "checked",
                                        "onUpdate:checked"
                                      ]),
                                      e(S, {
                                        value: k.name,
                                        "onUpdate:value": (B) => k.name = B,
                                        placeholder: a(n)("sqlNamePlaceholder"),
                                        style: {
                                          width: "200px"
                                        }
                                      }, null, 8, [
                                        "value",
                                        "onUpdate:value",
                                        "placeholder"
                                      ]),
                                      e(w, {
                                        onClick: (B) => s($),
                                        type: "error",
                                        quaternary: ""
                                      }, {
                                        icon: t(() => [
                                          e(A, {
                                            component: a(La)
                                          }, null, 8, [
                                            "component"
                                          ])
                                        ]),
                                        default: t(() => [
                                          _(" " + o(a(n)("deleteCustomSql")), 1)
                                        ]),
                                        _: 1
                                      }, 8, [
                                        "onClick"
                                      ])
                                    ]),
                                    _: 2
                                  }, 1024),
                                  e(S, {
                                    value: k.sql,
                                    "onUpdate:value": (B) => k.sql = B,
                                    type: "textarea",
                                    placeholder: a(n)("sqlPlaceholder"),
                                    autosize: {
                                      minRows: 2
                                    },
                                    class: "sql-input"
                                  }, null, 8, [
                                    "value",
                                    "onUpdate:value",
                                    "placeholder"
                                  ])
                                ]),
                                _: 2
                              }, 1024)
                            ]),
                            _: 2
                          }, 1024))), 128)),
                          e(w, {
                            onClick: p
                          }, {
                            icon: t(() => [
                              e(A, {
                                component: a(Aa)
                              }, null, 8, [
                                "component"
                              ])
                            ]),
                            default: t(() => [
                              _(" " + o(a(n)("addCustomSql")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "tab"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  xl = Z(kl, [
    [
      "__scopeId",
      "data-v-2f016879"
    ]
  ]);
  Al = {
    class: "center"
  };
  Cl = {
    __name: "DatabaseManager",
    setup(m) {
      const d = te(), r = f({
        need_initialization: false,
        need_migration: false,
        current_db_version: "",
        code_db_version: ""
      }), { t: l } = ee({
        messages: {
          en: {
            need_initialization_tip: "Database initialization is required. Please initialize the database.",
            need_migration_tip: "Database migration is required. Please migrate the database.",
            current_db_version: "Current DB Version",
            code_db_version: "Code Needed DB Version",
            init: "Initialize Database",
            migration: "Migrate Database",
            initializationSuccess: "Database initialized successfully",
            migrationSuccess: "Database migrated successfully"
          },
          zh: {
            need_initialization_tip: "\u9700\u8981\u521D\u59CB\u5316\u6570\u636E\u5E93\uFF0C\u8BF7\u521D\u59CB\u5316\u6570\u636E\u5E93",
            need_migration_tip: "\u9700\u8981\u8FC1\u79FB\u6570\u636E\u5E93\uFF0C\u8BF7\u8FC1\u79FB\u6570\u636E\u5E93",
            current_db_version: "\u5F53\u524D\u6570\u636E\u5E93\u7248\u672C",
            code_db_version: "\u9700\u8981\u7684\u6570\u636E\u5E93\u7248\u672C",
            init: "\u521D\u59CB\u5316\u6570\u636E\u5E93",
            migration: "\u5347\u7EA7\u6570\u636E\u5E93 Schema",
            initializationSuccess: "\u6570\u636E\u5E93\u521D\u59CB\u5316\u6210\u529F",
            migrationSuccess: "\u6570\u636E\u5E93\u5347\u7EA7\u6210\u529F"
          }
        }
      }), n = async () => {
        try {
          const s = await P.fetch("/admin/db_version");
          s && Object.assign(r.value, s);
        } catch (s) {
          d.error(s.message || "error");
        }
      }, v = async () => {
        try {
          await P.fetch("/admin/db_initialize", {
            method: "POST"
          }), await n(), d.success(l("initializationSuccess"));
        } catch (s) {
          d.error(s.message || "error");
        }
      }, p = async () => {
        try {
          await P.fetch("/admin/db_migration", {
            method: "POST"
          }), await n(), d.success(l("migrationSuccess"));
        } catch (s) {
          d.error(s.message || "error");
        }
      };
      return ae(async () => {
        await n();
      }), (s, b) => {
        const y = O, i = Se, c = ue;
        return R(), J("div", Al, [
          e(c, {
            bordered: false,
            embedded: ""
          }, {
            default: t(() => [
              r.value.need_initialization ? (R(), X(i, {
                key: 0,
                type: "warning",
                "show-icon": false,
                bordered: false
              }, {
                default: t(() => [
                  M("span", null, o(a(l)("need_initialization_tip")), 1),
                  e(y, {
                    onClick: v,
                    type: "primary",
                    secondary: "",
                    block: "",
                    loading: s.loading
                  }, {
                    default: t(() => [
                      _(o(a(l)("init")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ])
                ]),
                _: 1
              })) : le("", true),
              r.value.need_migration ? (R(), X(i, {
                key: 1,
                type: "warning",
                "show-icon": false,
                bordered: false
              }, {
                default: t(() => [
                  M("span", null, o(a(l)("need_migration_tip")), 1),
                  e(y, {
                    onClick: p,
                    type: "primary",
                    secondary: "",
                    block: "",
                    loading: s.loading
                  }, {
                    default: t(() => [
                      _(o(a(l)("migration")), 1)
                    ]),
                    _: 1
                  }, 8, [
                    "loading"
                  ])
                ]),
                _: 1
              })) : le("", true),
              e(i, {
                type: "info",
                "show-icon": false,
                bordered: false
              }, {
                default: t(() => [
                  M("span", null, o(a(l)("current_db_version")) + ": " + o(r.value.current_db_version || "unknown") + ", " + o(a(l)("code_db_version")) + ": " + o(r.value.code_db_version), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  At = Z(Cl, [
    [
      "__scopeId",
      "data-v-6eef5c21"
    ]
  ]);
  Sl = {
    class: "center"
  };
  Ll = {
    key: 0
  };
  Ul = re({
    __name: "Telegram",
    setup(m) {
      const d = te(), { t: r } = ee({
        messages: {
          en: {
            init: "Init",
            successTip: "Success",
            status: "Check Status",
            enableTelegramAllowList: "Enable Telegram Allow List(Manually input Chat ID)",
            enable: "Enable",
            telegramAllowList: "Telegram Allow List(Manually input telegram Chat ID)",
            manualInputPrompt: "Type and press Enter to add",
            save: "Save",
            miniAppUrl: "Telegram Mini App URL",
            enableGlobalMailPush: "Enable Global Mail Push(Manually input telegram Chat ID)",
            globalMailPushList: "Global Mail Push Chat ID List",
            globalMailPushListTip: "Support chat_id of private chat/group/channel. You can send a message to your bot, then visit this link to see chat_id, https://api.telegram.org/bot<Replace with your BOT TOKEN>/getUpdates"
          },
          zh: {
            init: "\u521D\u59CB\u5316",
            successTip: "\u6210\u529F",
            status: "\u67E5\u770B\u72B6\u6001",
            enableTelegramAllowList: "\u542F\u7528 Telegram \u767D\u540D\u5355(\u624B\u52A8\u8F93\u5165 Chat ID, \u56DE\u8F66\u589E\u52A0)",
            enable: "\u542F\u7528",
            telegramAllowList: "Telegram \u767D\u540D\u5355(\u624B\u52A8\u8F93\u5165 Chat ID, \u56DE\u8F66\u589E\u52A0)",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            save: "\u4FDD\u5B58",
            miniAppUrl: "\u7535\u62A5\u5C0F\u7A0B\u5E8F URL(\u8BF7\u8F93\u5165\u4F60\u90E8\u7F72\u7684\u7535\u62A5\u5C0F\u7A0B\u5E8F\u7F51\u9875\u5730\u5740)",
            enableGlobalMailPush: "\u542F\u7528\u5168\u5C40\u90AE\u4EF6\u63A8\u9001(\u624B\u52A8\u8F93\u5165\u90AE\u7BB1\u7BA1\u7406\u5458\u7684 telegram Chat ID, \u56DE\u8F66\u589E\u52A0)",
            globalMailPushList: "\u5168\u5C40\u90AE\u4EF6\u63A8\u9001 Chat ID \u5217\u8868",
            globalMailPushListTip: "\u652F\u6301\u5BF9\u8BDD/\u7FA4\u7EC4/\u9891\u9053\u7684 Chat ID, \u60A8\u53EF\u4EE5\u53D1\u9001\u4E00\u6761\u6D88\u606F\u7ED9\u60A8\u7684\u673A\u5668\u4EBA\uFF0C\u7136\u540E\u8BBF\u95EE\u6B64\u94FE\u63A5\u6765\u67E5\u770B chat_id, https://api.telegram.org/bot<\u8FD9\u91CC\u66FF\u6362\u6210\u60A8\u7684 BOT TOKEN>/getUpdates"
          }
        }
      }), l = f({
        fetched: false
      }), n = async () => {
        try {
          const i = await P.fetch("/admin/telegram/status");
          Object.assign(l.value, i), l.value.fetched = true;
        } catch (i) {
          d.error(i.message || "error");
        }
      }, v = async () => {
        try {
          await P.fetch("/admin/telegram/init", {
            method: "POST"
          }), d.success(r("successTip"));
        } catch (i) {
          d.error(i.message || "error");
        }
      };
      class p {
        constructor(c, x, w, U, u) {
          __publicField(this, "enableAllowList");
          __publicField(this, "allowList");
          __publicField(this, "miniAppUrl");
          __publicField(this, "enableGlobalMailPush");
          __publicField(this, "globalMailPushList");
          this.enableAllowList = c, this.allowList = x, this.miniAppUrl = w, this.enableGlobalMailPush = U, this.globalMailPushList = u;
        }
      }
      const s = f(new p(false, [], "", false, [])), b = async () => {
        try {
          const i = await P.fetch("/admin/telegram/settings");
          Object.assign(s.value, i);
        } catch (i) {
          d.error(i.message || "error");
        }
      }, y = async () => {
        try {
          await P.fetch("/admin/telegram/settings", {
            method: "POST",
            body: JSON.stringify(s.value)
          }), d.success(r("successTip"));
        } catch (i) {
          d.error(i.message || "error");
        }
      };
      return ae(async () => {
        await b();
      }), (i, c) => {
        const x = O, w = De, U = Ke, u = Le, g = se, A = xe, z = ge, j = de, T = ue;
        return R(), J("div", Sl, [
          e(T, {
            bordered: false,
            embedded: "",
            style: {
              "max-width": "800px",
              overflow: "auto"
            }
          }, {
            default: t(() => [
              e(w, {
                justify: "end"
              }, {
                default: t(() => [
                  e(x, {
                    onClick: n,
                    secondary: ""
                  }, {
                    default: t(() => [
                      _(o(a(r)("status")), 1)
                    ]),
                    _: 1
                  }),
                  e(x, {
                    onClick: v,
                    type: "primary"
                  }, {
                    default: t(() => [
                      _(o(a(r)("init")), 1)
                    ]),
                    _: 1
                  }),
                  e(x, {
                    onClick: y,
                    type: "primary"
                  }, {
                    default: t(() => [
                      _(o(a(r)("save")), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              e(T, {
                bordered: false,
                embedded: ""
              }, {
                default: t(() => [
                  e(z, {
                    label: a(r)("enableTelegramAllowList")
                  }, {
                    default: t(() => [
                      e(A, null, {
                        default: t(() => [
                          e(U, {
                            checked: s.value.enableAllowList,
                            "onUpdate:checked": c[0] || (c[0] = (S) => s.value.enableAllowList = S),
                            style: {
                              width: "20%"
                            }
                          }, {
                            default: t(() => [
                              _(o(a(r)("enable")), 1)
                            ]),
                            _: 1
                          }, 8, [
                            "checked"
                          ]),
                          e(g, {
                            value: s.value.allowList,
                            "onUpdate:value": c[1] || (c[1] = (S) => s.value.allowList = S),
                            filterable: "",
                            multiple: "",
                            tag: "",
                            style: {
                              width: "80%"
                            },
                            placeholder: a(r)("telegramAllowList")
                          }, {
                            empty: t(() => [
                              e(u, {
                                depth: "3"
                              }, {
                                default: t(() => [
                                  _(o(a(r)("manualInputPrompt")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "value",
                            "placeholder"
                          ])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  c[5] || (c[5] = M("br", null, null, -1)),
                  e(z, {
                    label: a(r)("enableGlobalMailPush")
                  }, {
                    feedback: t(() => [
                      e(u, {
                        depth: "3"
                      }, {
                        default: t(() => [
                          _(o(a(r)("globalMailPushListTip")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    default: t(() => [
                      e(A, null, {
                        default: t(() => [
                          e(U, {
                            checked: s.value.enableGlobalMailPush,
                            "onUpdate:checked": c[2] || (c[2] = (S) => s.value.enableGlobalMailPush = S),
                            style: {
                              width: "20%"
                            }
                          }, {
                            default: t(() => [
                              _(o(a(r)("enable")), 1)
                            ]),
                            _: 1
                          }, 8, [
                            "checked"
                          ]),
                          e(g, {
                            value: s.value.globalMailPushList,
                            "onUpdate:value": c[3] || (c[3] = (S) => s.value.globalMailPushList = S),
                            filterable: "",
                            multiple: "",
                            tag: "",
                            style: {
                              width: "80%"
                            },
                            placeholder: a(r)("globalMailPushList")
                          }, {
                            empty: t(() => [
                              e(u, {
                                depth: "3"
                              }, {
                                default: t(() => [
                                  _(o(a(r)("manualInputPrompt")), 1)
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          }, 8, [
                            "value",
                            "placeholder"
                          ])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  c[6] || (c[6] = M("br", null, null, -1)),
                  e(z, {
                    label: a(r)("miniAppUrl")
                  }, {
                    default: t(() => [
                      e(j, {
                        value: s.value.miniAppUrl,
                        "onUpdate:value": c[4] || (c[4] = (S) => s.value.miniAppUrl = S)
                      }, null, 8, [
                        "value"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ])
                ]),
                _: 1
              }),
              l.value.fetched ? (R(), J("pre", Ll, o(JSON.stringify(l.value, null, 2)), 1)) : le("", true)
            ]),
            _: 1
          })
        ]);
      };
    }
  });
  Il = Z(Ul, [
    [
      "__scopeId",
      "data-v-008f01c5"
    ]
  ]);
  Ml = {
    class: "center"
  };
  Tl = re({
    __name: "Webhook",
    setup(m) {
      const d = te(), { t: r } = ee({
        messages: {
          en: {
            successTip: "Success",
            enableAllowList: "Enable Allow List (Restrict webhook access to specific users)",
            webhookAllowList: "Webhook Allow List(Enter the mail address that is allowed to use webhook and enter)",
            manualInputPrompt: "Type and press Enter to add",
            save: "Save",
            notEnabled: "Webhook is not enabled"
          },
          zh: {
            successTip: "\u6210\u529F",
            enableAllowList: "\u542F\u7528\u767D\u540D\u5355 (\u9650\u5236 webhook \u8BBF\u95EE\u6743\u9650\uFF0C\u53EA\u6709\u767D\u540D\u5355\u4E2D\u7684\u7528\u6237\u53EF\u4EE5\u4F7F\u7528)",
            webhookAllowList: "Webhook \u767D\u540D\u5355(\u8BF7\u8F93\u5165\u5141\u8BB8\u4F7F\u7528webhook \u7684\u90AE\u7BB1\u5730\u5740, \u56DE\u8F66\u589E\u52A0)",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            save: "\u4FDD\u5B58",
            notEnabled: "Webhook \u672A\u5F00\u542F"
          }
        }
      });
      class l {
        constructor(i, c) {
          __publicField(this, "enableAllowList");
          __publicField(this, "allowList");
          this.enableAllowList = i, this.allowList = c;
        }
      }
      const n = f(new l(false, [])), v = f(false), p = f(""), s = async () => {
        try {
          const y = await P.fetch("/admin/webhook/settings");
          Object.assign(n.value, y), v.value = true;
        } catch (y) {
          p.value = y.message || "error";
        }
      }, b = async () => {
        try {
          await P.fetch("/admin/webhook/settings", {
            method: "POST",
            body: JSON.stringify(n.value)
          }), d.success(r("successTip"));
        } catch (y) {
          d.error(y.message || "error");
        }
      };
      return ae(async () => {
        await s();
      }), (y, i) => {
        const c = O, x = De, w = Ve, U = ge, u = Le, g = se, A = ue, z = sa;
        return R(), J("div", Ml, [
          v.value ? (R(), X(A, {
            key: 0,
            bordered: false,
            embedded: "",
            style: {
              "max-width": "800px",
              overflow: "auto"
            }
          }, {
            default: t(() => [
              e(x, {
                justify: "end"
              }, {
                default: t(() => [
                  e(c, {
                    onClick: b,
                    type: "primary"
                  }, {
                    default: t(() => [
                      _(o(a(r)("save")), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              e(U, {
                label: a(r)("enableAllowList")
              }, {
                default: t(() => [
                  e(w, {
                    value: n.value.enableAllowList,
                    "onUpdate:value": i[0] || (i[0] = (j) => n.value.enableAllowList = j),
                    round: false
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ]),
              e(U, {
                label: a(r)("webhookAllowList")
              }, {
                default: t(() => [
                  e(g, {
                    value: n.value.allowList,
                    "onUpdate:value": i[1] || (i[1] = (j) => n.value.allowList = j),
                    filterable: "",
                    multiple: "",
                    tag: "",
                    placeholder: a(r)("webhookAllowList")
                  }, {
                    empty: t(() => [
                      e(u, {
                        depth: "3"
                      }, {
                        default: t(() => [
                          _(o(a(r)("manualInputPrompt")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "value",
                    "placeholder"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ])
            ]),
            _: 1
          })) : (R(), X(z, {
            key: 1,
            status: "404",
            title: a(r)("notEnabled"),
            description: p.value
          }, null, 8, [
            "title",
            "description"
          ]))
        ]);
      };
    }
  });
  Pl = Z(Tl, [
    [
      "__scopeId",
      "data-v-6baca40b"
    ]
  ]);
  Dl = re({
    __name: "MailWebhook",
    setup(m) {
      const d = async () => await P.fetch("/admin/mail_webhook/settings"), r = async (n) => {
        await P.fetch("/admin/mail_webhook/settings", {
          method: "POST",
          body: JSON.stringify(n)
        });
      }, l = async (n) => {
        await P.fetch("/admin/mail_webhook/test", {
          method: "POST",
          body: JSON.stringify(n)
        });
      };
      return (n, v) => (R(), X(oa, {
        fetchData: d,
        saveSettings: r,
        testSettings: l
      }));
    }
  });
  El = {
    class: "center"
  };
  $l = {
    __name: "WorkerConfig",
    setup(m) {
      const { loading: d } = ie(), r = te(), l = f({}), n = async () => {
        try {
          const v = await P.fetch("/admin/worker/configs");
          Object.assign(l.value, v);
        } catch (v) {
          r.error(v.message || "error");
        }
      };
      return ae(async () => {
        await n();
      }), (v, p) => {
        const s = ue;
        return R(), J("div", El, [
          e(s, {
            bordered: false,
            embedded: "",
            style: {
              "max-width": "800px",
              overflow: "auto"
            }
          }, {
            default: t(() => [
              M("pre", null, o(JSON.stringify(l.value, null, 2)), 1)
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  Ct = Z($l, [
    [
      "__scopeId",
      "data-v-92d764b2"
    ]
  ]);
  Rl = {
    class: "center"
  };
  Bl = {
    style: {
      "line-height": "1.8"
    }
  };
  Ol = {
    __name: "IpBlacklistSettings",
    setup(m) {
      const { loading: d } = ie(), r = te(), { t: l } = ee({
        messages: {
          en: {
            title: "IP Blacklist Settings",
            manualInputPrompt: "Type pattern and press Enter to add",
            save: "Save",
            successTip: "Save Success",
            enable_ip_blacklist: "Enable IP Blacklist",
            enable_tip: "Block IPs matching blacklist patterns from accessing rate-limited APIs",
            ip_blacklist: "IP Blacklist Patterns",
            ip_blacklist_placeholder: "Enter pattern (e.g., 192.168.1 or ^10\\.0\\.0\\.5$)",
            asn_blacklist: "ASN Organization Blacklist",
            asn_blacklist_placeholder: "Enter ASN organization (e.g., Google, Amazon)",
            fingerprint_blacklist: "Browser Fingerprint Blacklist",
            fingerprint_blacklist_placeholder: "Enter fingerprint ID (e.g., a1b2c3d4e5f6g7h8)",
            tip_ip: 'IP Blacklist: Supports text matching (e.g., "192.168.1") or regex (e.g., "^10\\.0\\.0\\.5$").',
            tip_asn: "ASN Organization: Block by ISP/provider. Case-insensitive text matching or regex.",
            tip_fingerprint: "Browser Fingerprint: Block by browser fingerprint. Supports exact matching or regex patterns.",
            tip_daily_limit: "Daily Limit: Restrict the maximum number of requests per IP address per day (1-1000000).",
            tip_scope: "Applies to: Create Address, Send Mail, External Send Mail API, User Registration, Verify Code",
            enable_daily_limit: "Enable Daily Request Limit",
            enable_daily_limit_tip: "Limit the number of API requests per IP address per day",
            daily_request_limit: "Daily Request Limit",
            daily_request_limit_placeholder: "Enter limit (e.g., 1000)"
          },
          zh: {
            title: "IP \u9ED1\u540D\u5355\u8BBE\u7F6E",
            manualInputPrompt: "\u8F93\u5165\u5339\u914D\u6A21\u5F0F\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            save: "\u4FDD\u5B58",
            successTip: "\u4FDD\u5B58\u6210\u529F",
            enable_ip_blacklist: "\u542F\u7528 IP \u9ED1\u540D\u5355",
            enable_tip: "\u963B\u6B62\u5339\u914D\u9ED1\u540D\u5355\u7684 IP \u8BBF\u95EE\u9650\u6D41 API",
            ip_blacklist: "IP \u9ED1\u540D\u5355\u5339\u914D\u6A21\u5F0F",
            ip_blacklist_placeholder: "\u8F93\u5165\u5339\u914D\u6A21\u5F0F\uFF08\u4F8B\u5982\uFF1A192.168.1 \u6216 ^10\\.0\\.0\\.5$\uFF09",
            asn_blacklist: "ASN \u7EC4\u7EC7\uFF08\u8FD0\u8425\u5546\uFF09\u9ED1\u540D\u5355",
            asn_blacklist_placeholder: "\u8F93\u5165 ASN \u7EC4\u7EC7\u540D\u79F0\uFF08\u4F8B\u5982\uFF1AGoogle, Amazon\uFF09",
            fingerprint_blacklist: "\u6D4F\u89C8\u5668\u6307\u7EB9\u9ED1\u540D\u5355",
            fingerprint_blacklist_placeholder: "\u8F93\u5165\u6307\u7EB9 ID\uFF08\u4F8B\u5982\uFF1Aa1b2c3d4e5f6g7h8\uFF09",
            tip_ip: 'IP \u9ED1\u540D\u5355\uFF1A\u652F\u6301\u6587\u672C\u5339\u914D\uFF08\u5982 "192.168.1"\uFF09\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\uFF08\u5982 "^10\\.0\\.0\\.5$"\uFF09\u3002',
            tip_asn: "ASN \u7EC4\u7EC7\uFF1A\u6839\u636E\u8FD0\u8425\u5546/ISP \u62C9\u9ED1\u3002\u652F\u6301\u4E0D\u533A\u5206\u5927\u5C0F\u5199\u7684\u6587\u672C\u5339\u914D\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\u3002",
            tip_fingerprint: "\u6D4F\u89C8\u5668\u6307\u7EB9\uFF1A\u6839\u636E\u6D4F\u89C8\u5668\u6307\u7EB9\u62C9\u9ED1\u3002\u652F\u6301\u5B8C\u5168\u5339\u914D\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\u3002",
            tip_daily_limit: "\u6BCF\u65E5\u9650\u6D41\uFF1A\u9650\u5236\u5355\u4E2A IP \u5730\u5740\u6BCF\u5929\u6700\u591A\u8BF7\u6C42\u6B21\u6570\uFF081-1000000\uFF09\u3002",
            tip_scope: "\u4F5C\u7528\u8303\u56F4\uFF1A\u521B\u5EFA\u90AE\u7BB1\u5730\u5740\u3001\u53D1\u9001\u90AE\u4EF6\u3001\u5916\u90E8\u53D1\u9001\u90AE\u4EF6 API\u3001\u7528\u6237\u6CE8\u518C\u3001\u9A8C\u8BC1\u7801\u9A8C\u8BC1",
            enable_daily_limit: "\u542F\u7528\u6BCF\u65E5\u8BF7\u6C42\u9650\u6D41",
            enable_daily_limit_tip: "\u9650\u5236\u6BCF\u4E2A IP \u5730\u5740\u6BCF\u5929\u7684 API \u8BF7\u6C42\u6B21\u6570",
            daily_request_limit: "\u6BCF\u65E5\u8BF7\u6C42\u6B21\u6570\u4E0A\u9650",
            daily_request_limit_placeholder: "\u8F93\u5165\u9650\u5236\u6B21\u6570\uFF08\u4F8B\u5982\uFF1A1000\uFF09"
          }
        }
      }), n = f(false), v = f([]), p = f([]), s = f([]), b = f(false), y = f(1e3), i = async () => {
        try {
          d.value = true;
          const x = await P.fetch("/admin/ip_blacklist/settings");
          n.value = x.enabled || false, v.value = x.blacklist || [], p.value = x.asnBlacklist || [], s.value = x.fingerprintBlacklist || [], b.value = x.enableDailyLimit || false, y.value = x.dailyRequestLimit || 1e3;
        } catch (x) {
          r.error(x.message || "error");
        } finally {
          d.value = false;
        }
      }, c = async () => {
        try {
          d.value = true, await P.fetch("/admin/ip_blacklist/settings", {
            method: "POST",
            body: JSON.stringify({
              enabled: n.value,
              blacklist: v.value || [],
              asnBlacklist: p.value || [],
              fingerprintBlacklist: s.value || [],
              enableDailyLimit: b.value,
              dailyRequestLimit: y.value
            })
          }), r.success(l("successTip"));
        } catch (x) {
          r.error(x.message || "error");
        } finally {
          d.value = false;
        }
      };
      return ae(async () => {
        await i();
      }), (x, w) => {
        const U = O, u = Se, g = Ve, A = Le, z = ge, j = se, T = ut, S = Je, I = qe, F = ue;
        return R(), J("div", Rl, [
          e(F, {
            title: a(l)("title"),
            bordered: false,
            embedded: "",
            style: {
              "max-width": "800px"
            }
          }, {
            "header-extra": t(() => [
              e(U, {
                onClick: c,
                type: "primary",
                loading: a(d)
              }, {
                default: t(() => [
                  _(o(a(l)("save")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              e(I, {
                vertical: "",
                size: 20
              }, {
                default: t(() => [
                  e(u, {
                    "show-icon": false,
                    bordered: false,
                    type: "info"
                  }, {
                    default: t(() => [
                      M("div", Bl, [
                        M("div", null, [
                          M("strong", null, o(a(l)("tip_scope")), 1)
                        ]),
                        M("div", null, "\u2022 " + o(a(l)("tip_ip")), 1),
                        M("div", null, "\u2022 " + o(a(l)("tip_asn")), 1),
                        M("div", null, "\u2022 " + o(a(l)("tip_fingerprint")), 1),
                        M("div", null, "\u2022 " + o(a(l)("tip_daily_limit")), 1)
                      ])
                    ]),
                    _: 1
                  }),
                  e(z, {
                    label: a(l)("enable_ip_blacklist")
                  }, {
                    default: t(() => [
                      e(g, {
                        value: n.value,
                        "onUpdate:value": w[0] || (w[0] = (W) => n.value = W),
                        round: false
                      }, null, 8, [
                        "value"
                      ]),
                      e(A, {
                        depth: "3",
                        style: {
                          "margin-left": "10px",
                          "font-size": "12px"
                        }
                      }, {
                        default: t(() => [
                          _(o(a(l)("enable_tip")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(z, {
                    label: a(l)("ip_blacklist")
                  }, {
                    default: t(() => [
                      e(j, {
                        value: v.value,
                        "onUpdate:value": w[1] || (w[1] = (W) => v.value = W),
                        filterable: "",
                        multiple: "",
                        tag: "",
                        placeholder: a(l)("ip_blacklist_placeholder"),
                        disabled: !n.value
                      }, {
                        empty: t(() => [
                          e(A, {
                            depth: "3"
                          }, {
                            default: t(() => [
                              _(o(a(l)("manualInputPrompt")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }, 8, [
                        "value",
                        "placeholder",
                        "disabled"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(z, {
                    label: a(l)("asn_blacklist")
                  }, {
                    default: t(() => [
                      e(j, {
                        value: p.value,
                        "onUpdate:value": w[2] || (w[2] = (W) => p.value = W),
                        filterable: "",
                        multiple: "",
                        tag: "",
                        placeholder: a(l)("asn_blacklist_placeholder"),
                        disabled: !n.value
                      }, {
                        empty: t(() => [
                          e(A, {
                            depth: "3"
                          }, {
                            default: t(() => [
                              _(o(a(l)("manualInputPrompt")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }, 8, [
                        "value",
                        "placeholder",
                        "disabled"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(z, {
                    label: a(l)("fingerprint_blacklist")
                  }, {
                    default: t(() => [
                      e(j, {
                        value: s.value,
                        "onUpdate:value": w[3] || (w[3] = (W) => s.value = W),
                        filterable: "",
                        multiple: "",
                        tag: "",
                        placeholder: a(l)("fingerprint_blacklist_placeholder"),
                        disabled: !n.value
                      }, {
                        empty: t(() => [
                          e(A, {
                            depth: "3"
                          }, {
                            default: t(() => [
                              _(o(a(l)("manualInputPrompt")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }, 8, [
                        "value",
                        "placeholder",
                        "disabled"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(T),
                  e(z, {
                    label: a(l)("enable_daily_limit")
                  }, {
                    default: t(() => [
                      e(g, {
                        value: b.value,
                        "onUpdate:value": w[4] || (w[4] = (W) => b.value = W),
                        round: false
                      }, null, 8, [
                        "value"
                      ]),
                      e(A, {
                        depth: "3",
                        style: {
                          "margin-left": "10px",
                          "font-size": "12px"
                        }
                      }, {
                        default: t(() => [
                          _(o(a(l)("enable_daily_limit_tip")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ]),
                  e(z, {
                    label: a(l)("daily_request_limit")
                  }, {
                    default: t(() => [
                      e(S, {
                        value: y.value,
                        "onUpdate:value": w[5] || (w[5] = (W) => y.value = W),
                        min: 1,
                        max: 1e6,
                        placeholder: a(l)("daily_request_limit_placeholder"),
                        disabled: !b.value,
                        style: {
                          width: "100%"
                        }
                      }, null, 8, [
                        "value",
                        "placeholder",
                        "disabled"
                      ])
                    ]),
                    _: 1
                  }, 8, [
                    "label"
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, [
            "title"
          ])
        ]);
      };
    }
  };
  zl = Z(Ol, [
    [
      "__scopeId",
      "data-v-6cc70158"
    ]
  ]);
  Nl = {
    class: "center"
  };
  ql = {
    key: 1
  };
  Vl = re({
    __name: "AiExtractSettings",
    setup(m) {
      const d = te(), { t: r } = ee({
        messages: {
          en: {
            title: "AI Email Extraction Settings",
            successTip: "Success",
            save: "Save",
            enableAllowList: "Enable Address Allowlist",
            enableAllowListTip: "When enabled, AI extraction will only process emails sent to addresses in the allowlist",
            allowList: "Address Allowlist (Enter address and press Enter, wildcards supported)",
            allowListTip: "Wildcard * matches any characters, e.g. *{'@'}example.com matches all addresses under example.com domain",
            manualInputPrompt: "Type and press Enter to add",
            disabledTip: "When disabled, AI extraction will process all email addresses"
          },
          zh: {
            title: "AI \u90AE\u4EF6\u63D0\u53D6\u8BBE\u7F6E",
            successTip: "\u6210\u529F",
            save: "\u4FDD\u5B58",
            enableAllowList: "\u542F\u7528\u5730\u5740\u767D\u540D\u5355",
            enableAllowListTip: "\u542F\u7528\u540E\uFF0CAI \u63D0\u53D6\u529F\u80FD\u4EC5\u5BF9\u767D\u540D\u5355\u4E2D\u7684\u90AE\u7BB1\u5730\u5740\u751F\u6548",
            allowList: "\u5730\u5740\u767D\u540D\u5355 (\u8BF7\u8F93\u5165\u5730\u5740\u5E76\u56DE\u8F66\uFF0C\u652F\u6301\u901A\u914D\u7B26)",
            allowListTip: "\u901A\u914D\u7B26 * \u53EF\u5339\u914D\u4EFB\u610F\u5B57\u7B26\uFF0C\u5982 *{'@'}example.com \u53EF\u5339\u914D example.com \u57DF\u540D\u4E0B\u7684\u6240\u6709\u5730\u5740",
            manualInputPrompt: "\u8F93\u5165\u540E\u6309\u56DE\u8F66\u952E\u6DFB\u52A0",
            disabledTip: "\u672A\u542F\u7528\u65F6\uFF0C\u6240\u6709\u90AE\u7BB1\u5730\u5740\u90FD\u53EF\u4F7F\u7528 AI \u63D0\u53D6\u529F\u80FD"
          }
        }
      }), l = f({
        enableAllowList: false,
        allowList: []
      }), n = async () => {
        try {
          const p = await P.fetch("/admin/ai_extract/settings");
          Object.assign(l.value, p);
        } catch (p) {
          d.error(p.message || "error");
        }
      }, v = async () => {
        try {
          await P.fetch("/admin/ai_extract/settings", {
            method: "POST",
            body: JSON.stringify(l.value)
          }), d.success(r("successTip"));
        } catch (p) {
          d.error(p.message || "error");
        }
      };
      return ae(async () => {
        await n();
      }), (p, s) => {
        const b = O, y = De, i = Ve, c = ge, x = Se, w = Le, U = se, u = ue;
        return R(), J("div", Nl, [
          e(u, {
            title: a(r)("title"),
            bordered: false,
            embedded: "",
            style: {
              "max-width": "800px",
              overflow: "auto"
            }
          }, {
            default: t(() => [
              e(y, {
                justify: "end"
              }, {
                default: t(() => [
                  e(b, {
                    onClick: v,
                    type: "primary"
                  }, {
                    default: t(() => [
                      _(o(a(r)("save")), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              e(c, {
                label: a(r)("enableAllowList")
              }, {
                default: t(() => [
                  e(i, {
                    value: l.value.enableAllowList,
                    "onUpdate:value": s[0] || (s[0] = (g) => l.value.enableAllowList = g),
                    round: false
                  }, null, 8, [
                    "value"
                  ])
                ]),
                _: 1
              }, 8, [
                "label"
              ]),
              l.value.enableAllowList ? le("", true) : (R(), X(x, {
                key: 0,
                type: "info",
                style: {
                  "margin-bottom": "16px"
                }
              }, {
                default: t(() => [
                  _(o(a(r)("disabledTip")), 1)
                ]),
                _: 1
              })),
              l.value.enableAllowList ? (R(), J("div", ql, [
                e(x, {
                  type: "warning",
                  style: {
                    "margin-bottom": "16px"
                  }
                }, {
                  default: t(() => [
                    _(o(a(r)("enableAllowListTip")), 1)
                  ]),
                  _: 1
                }),
                e(c, {
                  label: a(r)("allowList")
                }, {
                  default: t(() => [
                    e(U, {
                      value: l.value.allowList,
                      "onUpdate:value": s[1] || (s[1] = (g) => l.value.allowList = g),
                      filterable: "",
                      multiple: "",
                      tag: "",
                      placeholder: a(r)("allowListTip")
                    }, {
                      empty: t(() => [
                        e(w, {
                          depth: "3"
                        }, {
                          default: t(() => [
                            _(o(a(r)("manualInputPrompt")), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, [
                      "value",
                      "placeholder"
                    ])
                  ]),
                  _: 1
                }, 8, [
                  "label"
                ]),
                e(w, {
                  depth: "3",
                  style: {
                    "font-size": "12px"
                  }
                }, {
                  default: t(() => [
                    _(o(a(r)("allowListTip")), 1)
                  ]),
                  _: 1
                })
              ])) : le("", true)
            ]),
            _: 1
          }, 8, [
            "title"
          ])
        ]);
      };
    }
  });
  Fl = Z(Vl, [
    [
      "__scopeId",
      "data-v-230de380"
    ]
  ]);
  jl = {
    key: 0
  };
  Wl = {
    style: {
      display: "flex",
      "justify-content": "center",
      padding: "20px"
    }
  };
  Hl = {
    __name: "Admin",
    setup(m) {
      const { adminAuth: d, showAdminAuth: r, adminTab: l, loading: n, globalTabplacement: v, showAdminPage: p, userSettings: s, openSettings: b } = ie(), y = te(), i = ra(), c = ia(() => (n.value = true, pa(() => import("./SendMail-tmYt0zPe.js"), __vite__mapDeps([0,1,2,3,4,5])).finally(() => n.value = false))), x = async () => {
        try {
          d.value = z.value, location.reload();
        } catch (S) {
          y.error(S.message || "error");
        }
      }, w = f(false), U = async () => {
        d.value = "", r.value = false, l.value = "account", y.success(u("logoutSuccess")), await i.push(ca("/", g.value));
      }, { t: u, locale: g } = ee({
        messages: {
          en: {
            accessHeader: "Admin Password",
            accessTip: "Please enter the admin password",
            mails: "Emails",
            sendMail: "Send Mail",
            qucickSetup: "Quick Setup",
            account: "Account",
            account_create: "Create Account",
            account_settings: "Account Settings",
            user: "User",
            user_management: "User Management",
            user_settings: "User Settings",
            userOauth2Settings: "Oauth2 Settings",
            roleAddressConfig: "Role Address Config",
            unknow: "Mails with unknow receiver",
            senderAccess: "Sender Access Control",
            sendBox: "Send Box",
            telegram: "Telegram Bot",
            webhookSettings: "Webhook Settings",
            statistics: "Statistics",
            maintenance: "Maintenance",
            database: "Database",
            workerconfig: "Worker Config",
            ipBlacklistSettings: "IP Blacklist",
            aiExtractSettings: "AI Extract Settings",
            appearance: "Appearance",
            about: "About",
            ok: "OK",
            mailWebhook: "Mail Webhook",
            adminAccount: "Admin",
            loginMethod: "Login Method",
            loginViaPassword: "Admin Password Login",
            loginViaUserAdmin: "User Admin Permission",
            loginViaDisabledCheck: "Disabled Password Check",
            logout: "Logout",
            logoutConfirmTitle: "Confirm Logout",
            logoutConfirmContent: "Are you sure you want to logout from admin panel?",
            confirm: "Confirm",
            logoutSuccess: "Logout successful"
          },
          zh: {
            accessHeader: "Admin \u5BC6\u7801",
            accessTip: "\u8BF7\u8F93\u5165 Admin \u5BC6\u7801",
            mails: "\u90AE\u4EF6",
            sendMail: "\u53D1\u9001\u90AE\u4EF6",
            qucickSetup: "\u5FEB\u901F\u8BBE\u7F6E",
            account: "\u8D26\u53F7",
            account_create: "\u521B\u5EFA\u8D26\u53F7",
            account_settings: "\u8D26\u53F7\u8BBE\u7F6E",
            user: "\u7528\u6237",
            user_management: "\u7528\u6237\u7BA1\u7406",
            user_settings: "\u7528\u6237\u8BBE\u7F6E",
            userOauth2Settings: "Oauth2 \u8BBE\u7F6E",
            roleAddressConfig: "\u89D2\u8272\u5730\u5740\u914D\u7F6E",
            unknow: "\u65E0\u6536\u4EF6\u4EBA\u90AE\u4EF6",
            senderAccess: "\u53D1\u4EF6\u6743\u9650\u63A7\u5236",
            sendBox: "\u53D1\u4EF6\u7BB1",
            telegram: "\u7535\u62A5\u673A\u5668\u4EBA",
            webhookSettings: "Webhook \u8BBE\u7F6E",
            statistics: "\u7EDF\u8BA1",
            maintenance: "\u7EF4\u62A4",
            database: "\u6570\u636E\u5E93",
            workerconfig: "Worker \u914D\u7F6E",
            ipBlacklistSettings: "IP \u9ED1\u540D\u5355",
            aiExtractSettings: "AI \u63D0\u53D6\u8BBE\u7F6E",
            appearance: "\u5916\u89C2",
            about: "\u5173\u4E8E",
            ok: "\u786E\u5B9A",
            mailWebhook: "\u90AE\u4EF6 Webhook",
            adminAccount: "\u7BA1\u7406\u5458",
            loginMethod: "\u767B\u5F55\u65B9\u5F0F",
            loginViaPassword: "Admin \u5BC6\u7801\u767B\u5F55",
            loginViaUserAdmin: "\u7528\u6237\u7BA1\u7406\u5458\u6743\u9650",
            loginViaDisabledCheck: "\u5DF2\u7981\u7528\u5BC6\u7801\u68C0\u67E5",
            logout: "\u9000\u51FA\u767B\u5F55",
            logoutConfirmTitle: "\u786E\u8BA4\u9000\u51FA",
            logoutConfirmContent: "\u786E\u5B9A\u8981\u9000\u51FA\u7BA1\u7406\u5458\u9762\u677F\u5417\uFF1F",
            confirm: "\u786E\u8BA4",
            logoutSuccess: "\u9000\u51FA\u6210\u529F"
          }
        }
      }), A = ke(() => !p.value || r.value), z = f(""), j = ke(() => !!d.value), T = ke(() => d.value ? u("loginViaPassword") : s.value.is_admin ? u("loginViaUserAdmin") : b.value.disableAdminPasswordCheck ? u("loginViaDisabledCheck") : "");
      return ae(async () => {
        s.value.user_id || await P.getUserSettings(y);
      }), (S, I) => {
        const F = de, W = O, k = Pe, $ = Ot, B = Bt, Y = Le, oe = ut, ce = qe, C = ue;
        return a(s).fetched ? (R(), J("div", jl, [
          e(k, {
            show: A.value,
            "onUpdate:show": I[1] || (I[1] = (E) => A.value = E),
            closable: false,
            closeOnEsc: false,
            maskClosable: false,
            preset: "dialog",
            title: a(u)("accessHeader")
          }, {
            action: t(() => [
              e(W, {
                onClick: x,
                type: "primary",
                loading: a(n)
              }, {
                default: t(() => [
                  _(o(a(u)("ok")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(u)("accessTip")), 1),
              e(F, {
                value: z.value,
                "onUpdate:value": I[0] || (I[0] = (E) => z.value = E),
                type: "password",
                "show-password-on": "click"
              }, null, 8, [
                "value"
              ])
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ]),
          a(p) ? (R(), X(B, {
            key: 0,
            type: "card",
            value: a(l),
            "onUpdate:value": I[3] || (I[3] = (E) => ot(l) ? l.value = E : null),
            placement: a(v)
          }, {
            default: t(() => [
              e($, {
                name: "qucickSetup",
                tab: a(u)("qucickSetup")
              }, {
                default: t(() => [
                  e(B, {
                    type: "bar",
                    "justify-content": "center",
                    animated: ""
                  }, {
                    default: t(() => [
                      e($, {
                        name: "database",
                        tab: a(u)("database")
                      }, {
                        default: t(() => [
                          e(At)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "account_settings",
                        tab: a(u)("account_settings")
                      }, {
                        default: t(() => [
                          e(wt)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "user_settings",
                        tab: a(u)("user_settings")
                      }, {
                        default: t(() => [
                          e(kt)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "workerconfig",
                        tab: a(u)("workerconfig")
                      }, {
                        default: t(() => [
                          e(Ct)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "account",
                tab: a(u)("account")
              }, {
                default: t(() => [
                  e(B, {
                    type: "bar",
                    "justify-content": "center",
                    animated: ""
                  }, {
                    default: t(() => [
                      e($, {
                        name: "account",
                        tab: a(u)("account")
                      }, {
                        default: t(() => [
                          e(Ha)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "account_create",
                        tab: a(u)("account_create")
                      }, {
                        default: t(() => [
                          e(Ja)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "account_settings",
                        tab: a(u)("account_settings")
                      }, {
                        default: t(() => [
                          e(wt)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "senderAccess",
                        tab: a(u)("senderAccess")
                      }, {
                        default: t(() => [
                          e(Ra)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "ipBlacklistSettings",
                        tab: a(u)("ipBlacklistSettings")
                      }, {
                        default: t(() => [
                          e(zl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "aiExtractSettings",
                        tab: a(u)("aiExtractSettings")
                      }, {
                        default: t(() => [
                          e(Fl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "webhook",
                        tab: a(u)("webhookSettings")
                      }, {
                        default: t(() => [
                          e(Pl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "user",
                tab: a(u)("user")
              }, {
                default: t(() => [
                  e(B, {
                    type: "bar",
                    "justify-content": "center",
                    animated: ""
                  }, {
                    default: t(() => [
                      e($, {
                        name: "user_management",
                        tab: a(u)("user_management")
                      }, {
                        default: t(() => [
                          e(ol)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "user_settings",
                        tab: a(u)("user_settings")
                      }, {
                        default: t(() => [
                          e(kt)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "userOauth2Settings",
                        tab: a(u)("userOauth2Settings")
                      }, {
                        default: t(() => [
                          e(pl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "roleAddressConfig",
                        tab: a(u)("roleAddressConfig")
                      }, {
                        default: t(() => [
                          e(vl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "mails",
                tab: a(u)("mails")
              }, {
                default: t(() => [
                  e(B, {
                    type: "bar",
                    "justify-content": "center",
                    animated: ""
                  }, {
                    default: t(() => [
                      e($, {
                        name: "mails",
                        tab: a(u)("mails")
                      }, {
                        default: t(() => [
                          e(gl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "unknow",
                        tab: a(u)("unknow")
                      }, {
                        default: t(() => [
                          e(yl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "sendBox",
                        tab: a(u)("sendBox")
                      }, {
                        default: t(() => [
                          e(Na)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "sendMail",
                        tab: a(u)("sendMail")
                      }, {
                        default: t(() => [
                          e(a(c))
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "mailWebhook",
                        tab: a(u)("mailWebhook")
                      }, {
                        default: t(() => [
                          e(Dl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "telegram",
                tab: a(u)("telegram")
              }, {
                default: t(() => [
                  e(Il)
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "statistics",
                tab: a(u)("statistics")
              }, {
                default: t(() => [
                  e(Oa)
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "maintenance",
                tab: a(u)("maintenance")
              }, {
                default: t(() => [
                  e(B, {
                    type: "bar",
                    "justify-content": "center",
                    animated: ""
                  }, {
                    default: t(() => [
                      e($, {
                        name: "database",
                        tab: a(u)("database")
                      }, {
                        default: t(() => [
                          e(At)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "workerconfig",
                        tab: a(u)("workerconfig")
                      }, {
                        default: t(() => [
                          e(Ct)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ]),
                      e($, {
                        name: "maintenance",
                        tab: a(u)("maintenance")
                      }, {
                        default: t(() => [
                          e(xl)
                        ]),
                        _: 1
                      }, 8, [
                        "tab"
                      ])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "appearance",
                tab: a(u)("appearance")
              }, {
                default: t(() => [
                  e(ua)
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "adminAccount",
                tab: a(u)("adminAccount")
              }, {
                default: t(() => [
                  M("div", Wl, [
                    e(C, {
                      style: {
                        width: "600px"
                      }
                    }, {
                      default: t(() => [
                        e(ce, {
                          vertical: ""
                        }, {
                          default: t(() => [
                            e(Y, {
                              strong: ""
                            }, {
                              default: t(() => [
                                _(o(a(u)("loginMethod")), 1)
                              ]),
                              _: 1
                            }),
                            e(Y, null, {
                              default: t(() => [
                                _(o(T.value), 1)
                              ]),
                              _: 1
                            }),
                            j.value ? (R(), X(oe, {
                              key: 0
                            })) : le("", true),
                            j.value ? (R(), X(W, {
                              key: 1,
                              type: "warning",
                              onClick: I[2] || (I[2] = (E) => w.value = true),
                              block: ""
                            }, {
                              default: t(() => [
                                _(o(a(u)("logout")), 1)
                              ]),
                              _: 1
                            })) : le("", true)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })
                  ])
                ]),
                _: 1
              }, 8, [
                "tab"
              ]),
              e($, {
                name: "about",
                tab: a(u)("about")
              }, {
                default: t(() => [
                  e(da)
                ]),
                _: 1
              }, 8, [
                "tab"
              ])
            ]),
            _: 1
          }, 8, [
            "value",
            "placement"
          ])) : le("", true),
          e(k, {
            show: w.value,
            "onUpdate:show": I[4] || (I[4] = (E) => w.value = E),
            preset: "dialog",
            title: a(u)("logoutConfirmTitle")
          }, {
            action: t(() => [
              e(W, {
                loading: a(n),
                onClick: U,
                size: "small",
                tertiary: "",
                type: "warning"
              }, {
                default: t(() => [
                  _(o(a(u)("confirm")), 1)
                ]),
                _: 1
              }, 8, [
                "loading"
              ])
            ]),
            default: t(() => [
              M("p", null, o(a(u)("logoutConfirmContent")), 1)
            ]),
            _: 1
          }, 8, [
            "show",
            "title"
          ])
        ])) : le("", true);
      };
    }
  };
  Gl = Z(Hl, [
    [
      "__scopeId",
      "data-v-ef349626"
    ]
  ]);
});
export {
  __tla,
  Gl as default
};
