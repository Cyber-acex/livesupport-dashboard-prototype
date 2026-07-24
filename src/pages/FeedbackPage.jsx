import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const ratingLabels = {
  1: 'Very poor',
  2: 'Could be better',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent'
};

function StatePanel({ title, message, tone = 'neutral' }) {
  return (
    <main className="feedback-shell">
      <section className={`feedback-state feedback-state-${tone}`}>
        <div className="feedback-mark" aria-hidden="true">{tone === 'success' ? '✓' : '•'}</div>
        <p className="feedback-eyebrow">LiveSupport</p>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function FeedbackPage() {
  const { token } = useParams();
  const [pageState, setPageState] = useState('loading');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/feedback/${encodeURIComponent(token || '')}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok) setPageState('form');
        else if (payload.status === 'used') setPageState('used');
        else if (payload.status === 'expired') setPageState('expired');
        else setPageState('not_found');
      })
      .catch(() => active && setPageState('not_found'));
    return () => { active = false; };
  }, [token]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/feedback/${encodeURIComponent(token || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 410) setPageState(payload.error?.includes('used') ? 'used' : 'expired');
        else throw new Error(payload.error || 'Unable to submit feedback');
        return;
      }
      setPageState('success');
    } catch (error) {
      setSubmitting(false);
      window.alert(error.message);
    }
  };

  if (pageState === 'loading') return <StatePanel title="Opening your feedback page" message="Just a moment while we prepare a secure form for you." />;
  if (pageState === 'used') return <StatePanel title="Feedback link already used" message="Thank you for your feedback. This secure link cannot be used again." />;
  if (pageState === 'expired') return <StatePanel title="Feedback Link Expired" message="This feedback request is no longer available. Thank you for your understanding." />;
  if (pageState === 'not_found') return <StatePanel title="Feedback Link Not Found" message="The feedback link you're trying to access doesn't exist or has been removed." />;
  if (pageState === 'success') {
    return (
      <main className="feedback-shell feedback-success-shell">
        {rating === 5 && <div className="feedback-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--i': index }} />)}</div>}
        <section className="feedback-state feedback-state-success">
          <div className="feedback-checkmark" aria-hidden="true">✓</div>
          <p className="feedback-eyebrow">LiveSupport</p>
          <h1>Thank You!</h1>
          <p>Your feedback has been successfully submitted.<br />We truly appreciate your time.</p>
        </section>
      </main>
    );
  }

  const visibleRating = hoveredRating || rating;
  return (
    <main className="feedback-shell">
      <section className="feedback-card" aria-labelledby="feedback-title">
        <div className="feedback-brand" aria-label="LiveSupport"><span>LS</span><strong>LiveSupport</strong></div>
        <div className="feedback-intro">
          <p className="feedback-eyebrow">Your voice matters</p>
          <h1 id="feedback-title">How did we do?</h1>
          <p>Your support request has been completed.<br />Please rate your experience.</p>
        </div>
        <form onSubmit={submitFeedback}>
          <fieldset className="feedback-rating-fieldset">
            <legend>Choose a rating</legend>
            <div className="feedback-stars" onMouseLeave={() => setHoveredRating(0)}>
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const active = value <= visibleRating;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`feedback-star ${active ? 'is-active' : ''}`}
                    aria-label={`${value} out of 5 stars, ${ratingLabels[value]}`}
                    aria-pressed={rating === value}
                    onMouseEnter={() => setHoveredRating(value)}
                    onFocus={() => setHoveredRating(value)}
                    onBlur={() => setHoveredRating(0)}
                    onClick={() => setRating(value)}
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                );
              })}
            </div>
            <p className="feedback-rating-label" aria-live="polite">{visibleRating ? ratingLabels[visibleRating] : 'Select a star rating'}</p>
          </fieldset>
          <label className="feedback-comment-label" htmlFor="feedback-comment">Would you like to tell us more? <span>Optional</span></label>
          <textarea id="feedback-comment" value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="Share a little about your experience..." rows={4} />
          <div className="feedback-form-footer"><span>{comment.length}/500</span><button className="feedback-submit" type="submit" disabled={!rating || submitting}>{submitting ? 'Submitting...' : 'Submit Feedback'} <span aria-hidden="true">→</span></button></div>
        </form>
        <p className="feedback-privacy">Your response is private and helps us improve every conversation.</p>
      </section>
    </main>
  );
}

export default FeedbackPage;
