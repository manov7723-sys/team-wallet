/**
 * @component NftIcon
 *
 * Inline SVG NFT/diamond-layers icon with configurable size and fill color props.
 */

const NftIcon = ({ size = 20, color = "currentColor" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 30 30">
      <path
        fill={color}
        d="M9 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4m12.5-5.5L12 1L2.5 6.5v11L12 23l9.5-5.5zM12 3.311l7.5 4.342v6.88l-4.562-2.736l-7.971 5.978L4.5 16.347V7.653zm0 17.378l-3.152-1.825l6.214-4.66l3.998 2.398z"
      />
    </svg>
  );
};

export default NftIcon;
