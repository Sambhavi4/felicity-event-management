const LoadingSpinner = ({ text = 'Loading...' }) => (
  <div className="page-loader">
    <div className="spinner"></div>
    <p className="text-muted">{text}</p>
  </div>
);

export default LoadingSpinner;
