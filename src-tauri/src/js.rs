//! Helpers that reproduce JavaScript semantics on top of `serde_json::Value`.
//!
//! The original generator ran on Node.js, so its output depends on JS rules
//! (truthiness, `String(x)`, number formatting, `JSON.stringify`). These
//! helpers keep the Rust port byte-for-byte compatible with that output.

use serde_json::{Map, Number, Value};

pub type Obj = Map<String, Value>;

/// `obj[key]` – `None` means `undefined`.
pub fn get<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    v.as_object().and_then(|o| o.get(key))
}

/// JS truthiness (`!!x`).
pub fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => {
            let f = n.as_f64().unwrap_or(0.0);
            f != 0.0 && !f.is_nan()
        }
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

/// `x === "literal"`
pub fn str_eq(v: Option<&Value>, s: &str) -> bool {
    matches!(v, Some(Value::String(x)) if x == s)
}

/// `x || fallback` returning a clone.
pub fn or(v: Option<&Value>, fallback: Value) -> Value {
    if truthy(v) {
        v.unwrap().clone()
    } else {
        fallback
    }
}

/// `x !== undefined ? x : fallback`
pub fn or_undef(v: Option<&Value>, fallback: Value) -> Value {
    match v {
        Some(x) => x.clone(),
        None => fallback,
    }
}

/// `String(x)`
pub fn js_string(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => number_to_string(n),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(a)) => a
            .iter()
            .map(|x| match x {
                Value::Null => String::new(),
                other => js_string(Some(other)),
            })
            .collect::<Vec<_>>()
            .join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}

/// `Number(x)` (ToNumber)
pub fn to_number(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => string_to_number(s),
        Some(Value::Array(_)) => string_to_number(&js_string(v)),
        Some(Value::Object(_)) => f64::NAN,
    }
}

fn string_to_number(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    match t {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }
    let lower = t.to_ascii_lowercase();
    for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            return u64::from_str_radix(rest, radix)
                .map(|n| n as f64)
                .unwrap_or(f64::NAN);
        }
    }
    if t.contains("inf") || t.contains("nan") || t.contains("NaN") {
        return f64::NAN;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// Builds a JSON number from an `f64` (integers are stored as integers).
pub fn num(f: f64) -> Value {
    if f.is_finite() && f.fract() == 0.0 && f.abs() < 9_007_199_254_740_992.0 {
        Value::Number(Number::from(f as i64))
    } else {
        Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
    }
}

/// JS `a + b`
pub fn js_add(a: Option<&Value>, b: Option<&Value>) -> Value {
    let is_str = |v: Option<&Value>| matches!(v, Some(Value::String(_)) | Some(Value::Array(_)) | Some(Value::Object(_)));
    if is_str(a) || is_str(b) {
        Value::String(format!("{}{}", js_string(a), js_string(b)))
    } else {
        num(to_number(a) + to_number(b))
    }
}

/// JS `Math.round`
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// `[...arr]` – clones an array (or returns an empty one).
pub fn spread(v: Option<&Value>) -> Value {
    match v {
        Some(Value::Array(a)) => Value::Array(a.clone()),
        Some(Value::String(s)) => Value::Array(s.chars().map(|c| Value::String(c.to_string())).collect()),
        _ => Value::Array(vec![]),
    }
}

fn number_to_string(n: &Number) -> String {
    if let Some(i) = n.as_i64() {
        return i.to_string();
    }
    if let Some(u) = n.as_u64() {
        return u.to_string();
    }
    f64_to_js(n.as_f64().unwrap_or(f64::NAN))
}

/// `Number.prototype.toString()` for doubles.
pub fn f64_to_js(f: f64) -> String {
    if f.is_nan() {
        return "NaN".into();
    }
    if f.is_infinite() {
        return if f > 0.0 { "Infinity".into() } else { "-Infinity".into() };
    }
    if f == 0.0 {
        return "0".into();
    }
    let neg = f < 0.0;
    // Rust's `{:e}` gives the shortest round-trip digits, like JS.
    let s = format!("{:e}", f.abs());
    let (mant, exp) = s.split_once('e').unwrap();
    let exp: i32 = exp.parse().unwrap();
    let digits: String = mant.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i32;
    let n = exp + 1;
    let mut out = String::new();
    if neg {
        out.push('-');
    }
    if k <= n && n <= 21 {
        out.push_str(&digits);
        for _ in 0..(n - k) {
            out.push('0');
        }
    } else if 0 < n && n <= 21 {
        out.push_str(&digits[..n as usize]);
        out.push('.');
        out.push_str(&digits[n as usize..]);
    } else if -6 < n && n <= 0 {
        out.push_str("0.");
        for _ in 0..(-n) {
            out.push('0');
        }
        out.push_str(&digits);
    } else {
        let e = n - 1;
        out.push_str(&digits[..1]);
        if k > 1 {
            out.push('.');
            out.push_str(&digits[1..]);
        }
        out.push('e');
        out.push(if e >= 0 { '+' } else { '-' });
        out.push_str(&e.abs().to_string());
    }
    out
}

/// `JSON.stringify(value, null, indent)`
pub fn stringify(v: &Value, indent: usize) -> String {
    let mut out = String::new();
    write_value(&mut out, v, indent, 0);
    out
}

fn write_value(out: &mut String, v: &Value, indent: usize, level: usize) {
    match v {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => {
            let f = n.as_f64().unwrap_or(0.0);
            if n.is_f64() && !f.is_finite() {
                out.push_str("null");
            } else {
                out.push_str(&number_to_string(n));
            }
        }
        Value::String(s) => write_string(out, s),
        Value::Array(a) => {
            if a.is_empty() {
                out.push_str("[]");
                return;
            }
            out.push('[');
            for (i, item) in a.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                newline(out, indent, level + 1);
                write_value(out, item, indent, level + 1);
            }
            newline(out, indent, level);
            out.push(']');
        }
        Value::Object(o) => {
            if o.is_empty() {
                out.push_str("{}");
                return;
            }
            out.push('{');
            for (i, (k, item)) in o.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                newline(out, indent, level + 1);
                write_string(out, k);
                out.push(':');
                if indent > 0 {
                    out.push(' ');
                }
                write_value(out, item, indent, level + 1);
            }
            newline(out, indent, level);
            out.push('}');
        }
    }
}

fn newline(out: &mut String, indent: usize, level: usize) {
    if indent > 0 {
        out.push('\n');
        for _ in 0..indent * level {
            out.push(' ');
        }
    }
}

fn write_string(out: &mut String, s: &str) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// Stable insertion sort that tolerates inconsistent (NaN) comparators,
/// matching `Array.prototype.sort((a, b) => a.x - b.x)` for small arrays.
pub fn js_sort_by<T>(v: &mut Vec<T>, cmp: impl Fn(&T, &T) -> f64) {
    for i in 1..v.len() {
        let mut j = i;
        while j > 0 && cmp(&v[j - 1], &v[j]) > 0.0 {
            v.swap(j - 1, j);
            j -= 1;
        }
    }
}

/// `str.replace(from, to)` – JS replaces only the first occurrence.
pub fn replace_first(s: &str, from: &str, to: &str) -> String {
    s.replacen(from, to, 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_match_js() {
        assert_eq!(f64_to_js(1.0), "1");
        assert_eq!(f64_to_js(0.6), "0.6");
        assert_eq!(f64_to_js(1.0 / 255.0), "0.00392156862745098");
        assert_eq!(f64_to_js(0.000001), "0.000001");
        assert_eq!(f64_to_js(0.0000001), "1e-7");
        assert_eq!(f64_to_js(1e21), "1e+21");
        assert_eq!(f64_to_js(123456789012.5), "123456789012.5");
        assert_eq!(f64_to_js(-2.5), "-2.5");
    }
}
