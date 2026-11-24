export const metadata = {
  title: "Privacy Policy — Multi-Hat",
};

const sectionStyle = { marginBottom: 28 };
const h2Style = { fontSize: 18, fontWeight: 600, marginBottom: 10, color: "#f1eef7" };
const pStyle = { lineHeight: 1.7, color: "#c7c3d1", marginBottom: 10 };
const liStyle = { lineHeight: 1.7, color: "#c7c3d1", marginBottom: 6 };

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0e13",
        color: "#f1eef7",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "48px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 680, width: "100%" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: "#8a8594", marginBottom: 36, fontSize: 14 }}>
          Last updated: November 24, 2026
        </p>

        <div style={sectionStyle}>
          <h2 style={h2Style}>What Multi-Hat is</h2>
          <p style={pStyle}>
            Multi-Hat is a tool that helps YouTube creators get role-specific advice (strategy,
            SEO, scripting, community management, and more) about their own channel. To do that
            well, it can read data from your own YouTube channel if you choose to connect it with
            Google sign-in. This page explains what we collect, why, and how you can control it.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Information we collect</h2>
          <p style={pStyle}>When you sign in with Google, we collect:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
            <li style={liStyle}>Your basic Google profile: name, email address, and profile picture.</li>
            <li style={liStyle}>
              A Google OAuth access token and refresh token, used only to make YouTube API requests
              on your behalf.
            </li>
          </ul>
          <p style={pStyle}>
            If you choose to use live YouTube data (instead of pasting your own notes in manually),
            we also read, using your authorization and the YouTube Data API and YouTube Analytics
            API:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
            <li style={liStyle}>Your channel's public profile (name, description, subscriber/view/video counts).</li>
            <li style={liStyle}>
              Your recent video metadata (titles, descriptions, thumbnails, publish dates, view/like/comment counts).
            </li>
            <li style={liStyle}>Top comments on your recent videos, when available.</li>
            <li style={liStyle}>Caption/transcript text for your videos, when available.</li>
            <li style={liStyle}>
              Channel-level analytics such as views, watch time, average view duration, and subscriber
              change over a recent period. We do not request or receive impressions or thumbnail
              click-through-rate — YouTube does not expose that data through any public or OAuth API;
              it's only visible to you inside YouTube Studio.
            </li>
          </ul>
          <p style={pStyle}>
            We also store the questions you ask, the AI-generated analysis and action items you're
            given, and whatever notes you choose to type in yourself (such as channel niche or goals).
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>How we use this information</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
            <li style={liStyle}>
              To generate the role-based analysis and action steps you ask for. Relevant data (your
              question, channel stats, video details, transcripts, comments) is sent to Anthropic's
              Claude API to produce that analysis. Anthropic processes this data to return a response
              and does not use it to train models, per Anthropic's own API terms.
            </li>
            <li style={liStyle}>To keep your task list, past runs, and channel profile saved so you can pick up where you left off.</li>
            <li style={liStyle}>To keep you signed in across visits.</li>
          </ul>
          <p style={pStyle}>We do not sell your data. We do not use your data for advertising. We do not share your YouTube data with other users of the app.</p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Where data is stored</h2>
          <p style={pStyle}>
            Your account, tokens, and saved data are stored in a Postgres database (hosted via Neon)
            tied to your Google account. Your data is kept separate from every other user's — each
            person who signs in only ever sees their own data.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Your controls</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
            <li style={liStyle}>
              You can revoke Multi-Hat's access to your Google account at any time from your{" "}
              <a href="https://myaccount.google.com/permissions" style={{ color: "#a78bfa" }}>
                Google Account permissions page
              </a>.
            </li>
            <li style={liStyle}>
              You can choose not to use live YouTube data at all, and instead paste in your own notes
              manually — live access is optional, not required to use the app.
            </li>
            <li style={liStyle}>
              You can request deletion of your account and all associated data by emailing us (see
              Contact below). We'll delete it within 30 days.
            </li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Data retention</h2>
          <p style={pStyle}>
            We keep your data for as long as your account is active, so your task list and history
            persist across sessions. If you delete your account, or ask us to, we delete your stored
            profile, tasks, run history, and OAuth tokens.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Third parties</h2>
          <p style={pStyle}>
            We use Google APIs (sign-in, YouTube Data API, YouTube Analytics API), Anthropic's Claude
            API (to generate analysis), and Neon/Vercel (hosting and database). Each of these
            providers processes data only to the extent needed to provide their service to us, under
            their own privacy and security terms.
          </p>
          <p style={pStyle}>
            Multi-Hat's use and transfer of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              style={{ color: "#a78bfa" }}
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Children's privacy</h2>
          <p style={pStyle}>
            Multi-Hat is not directed at children under 13, and we do not knowingly collect data from
            them.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Changes to this policy</h2>
          <p style={pStyle}>
            If this policy changes in a meaningful way, we'll update the date at the top of this page.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Contact</h2>
          <p style={pStyle}>
            Questions, or want your data deleted? Email{" "}
            <a href="mailto:joshuajumbodesign@gmail.com" style={{ color: "#a78bfa" }}>
              joshuajumbodesign@gmail.com
            </a>
            .
          </p>
        </div>

        <a href="/" style={{ color: "#8a8594", fontSize: 14 }}>
          ← Back to Multi-Hat
        </a>
      </div>
    </div>
  );
}
