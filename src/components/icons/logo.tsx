export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 7h3" />
      <path d="M7 12h5" />
      <path d="M7 17h7" />
      <path d="m16 8-2 2 2 2" />
      <path d="m20 8-2 2 2 2" />
    </svg>
  );
}
