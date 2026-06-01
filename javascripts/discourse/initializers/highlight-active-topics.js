import { withPluginApi } from "discourse/lib/plugin-api";

// Adds visual hierarchy to topic lists (#2): rows whose reply/post count meets
// a threshold get a `hot-topic` class so CSS (scss/landing-ia.scss) can give
// active discussion more weight than dormant threads. Pure presentation — it
// only toggles a class based on the count Discourse already rendered.
const HOT_REPLY_THRESHOLD = 20;

function tagHotTopics() {
  document.querySelectorAll(".topic-list-item").forEach((row) => {
    const countEl = row.querySelector(".num.posts .number, .posts-map .number");
    if (!countEl) {
      return;
    }

    const replies = parseInt(countEl.textContent.replace(/[^\d]/g, ""), 10);
    row.classList.toggle(
      "hot-topic",
      !Number.isNaN(replies) && replies >= HOT_REPLY_THRESHOLD
    );
  });
}

export default {
  name: "highlight-active-topics",

  initialize() {
    withPluginApi("1.8.0", (api) => {
      // Re-tag after each navigation; defer a frame so the list has rendered.
      api.onPageChange(() => {
        window.requestAnimationFrame(tagHotTopics);
      });
    });
  },
};
