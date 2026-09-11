/**
 * @component StackIcon
 *
 * Inline SVG stacked-layers / program icon with configurable size and
 * stroke color props. Used to represent program or developer tooling contexts.
 */
const StackIcon = ({ size = 20, color = "currentColor" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 30 30">
      <g fill="none" stroke={color} strokeWidth={1.5}>
        <path d="M8 6c3.314 0 6-.895 6-2s-2.686-2-6-2s-6 .895-6 2s2.686 2 6 2Z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.5 9a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13"
        />
        <path
          strokeLinejoin="round"
          d="M15.5 19v-3.5m3-1.75-3-1.75-3 1.75m0 0v3.5l3 1.75 3-1.75v-3.5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2 4v8.043c0 .704 1.178 1.59 4.13 1.957"
        />
      </g>
    </svg>
  );
};

export default StackIcon;
