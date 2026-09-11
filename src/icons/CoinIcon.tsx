/**
 * @component CoinIcon
 *
 * Inline SVG coin/circle icon with configurable size and stroke color props.
 */
const CoinIcon = ({ size = 20, color = "#000" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 30 30">
      <path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.5}
        d="M14 18a8 8 0 1 0 0-16a8 8 0 0 0 0 16Zm-.833 2.969A7.398 7.398 0 0 1 3.03 10.833"
      />
    </svg>
  );
};

export default CoinIcon;
