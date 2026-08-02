export default function MyPageField({ label, value = "", placeholder, type = "text", readOnly = false }) {
    return (
        <label className="block text-sm font-semibold text-slate-600">
            {label}
            <input
                type={type}
                defaultValue={value}
                placeholder={placeholder}
                readOnly={readOnly}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 outline-none focus:border-slate-900"
            />
        </label>
    );
}
