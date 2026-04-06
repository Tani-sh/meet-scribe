export default function StatusIndicator({ status }) {
  const labels = {
    idle: 'Idle',
    joining: 'Joining Meet',
    launching: 'Launching Bot',
    navigating: 'Navigating',
    listening: 'Listening',
    summarizing: 'Summarizing',
    done: 'Complete',
    error: 'Error',
  };

  return (
    <span className={`status-badge status-${status}`}>
      <span className="dot"></span>
      {labels[status] || status}
    </span>
  );
}
