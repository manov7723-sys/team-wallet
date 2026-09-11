/**
 * @component CheckIcon
 *
 * Inline SVG checkmark icon styled with text-success and fixed 32px size.
 */
const CheckIcon = () => {
  return (
    <svg className="text-success h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
};

export default CheckIcon;
