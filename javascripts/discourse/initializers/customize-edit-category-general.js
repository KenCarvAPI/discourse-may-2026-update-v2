import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "customize-edit-category-general",

  initialize() {
    withPluginApi("1.8.0", (api) => {
      // Discourse 3.5+ rewrote edit-category-general as a Glimmer component
      // with no didInsertElement/willDestroyElement hooks. Toggle the body
      // class from the Glimmer lifecycle instead. mobile.scss relies on
      // `body.edit-category` to opt this screen out of the generic mobile
      // #main-outlet layout.
      api.modifyClass(
        "component:edit-category-general",
        (Superclass) =>
          class extends Superclass {
            constructor() {
              super(...arguments);
              document.body.classList.add("edit-category");
            }

            willDestroy() {
              super.willDestroy(...arguments);
              document.body.classList.remove("edit-category");
            }
          }
      );
    });
  },
};
