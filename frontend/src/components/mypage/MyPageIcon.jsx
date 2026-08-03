const paths = {
    user: (
        <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20v-1.25a6.5 6.5 0 0 1 13 0V20" />
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
