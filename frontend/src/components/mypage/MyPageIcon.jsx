const paths = {
    user: (
        <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20v-1.25a6.5 6.5 0 0 1 13 0V20" />
        </>
    ),
    hanger: (
        <>
            <path d="M12 4.5a2.5 2.5 0 1 1 2.5 2.5" />
            <path d="m12 7 6.6 7.15a1.55 1.55 0 0 1-1.14 2.6H6.54a1.55 1.55 0 0 1-1.14-2.6L12 7Z" />
        </>
    ),
    edit: (
        <>
            <path d="m4 20 3.5-.85L18 8.65 15.35 6 4.85 16.5 4 20Z" />
            <path d="m14.75 6.6 2.65 2.65" />
        </>
    ),
    bookmark: <path d="M6.5 4.5h11v15l-5.5-3-5.5 3v-15Z" />,
    heart: <path d="M20 8.75C20 13 12 18.5 12 18.5S4 13 4 8.75A3.75 3.75 0 0 1 10.5 6.2L12 7.7l1.5-1.5A3.75 3.75 0 0 1 20 8.75Z" />,
    check: <path d="m5 12 4.25 4.25L19 6.5" />,
    logout: (
        <>
            <path d="M10 5H5v14h5" />
            <path d="M13 8l4 4-4 4" />
            <path d="M9 12h8" />
        </>
    ),
    users: (
        <>
            <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
            <circle cx="9.5" cy="7" r="3" />
            <path d="M17 11a3 3 0 1 0-1.5-5.6" />
        </>
    ),
};

export default function MyPageIcon({ name, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            {paths[name]}
        </svg>
    );
}
