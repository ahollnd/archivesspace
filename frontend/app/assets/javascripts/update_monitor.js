$(function() {

  // Every 10 seconds:
  // Poll to check if the current version is still current
  // and if any users are editing the same record
  //
  // Ensure this value is less than the timeout to
  // remove the status from the update monitor.
  // See EXPIRE_SECONDS in backend/app/model/active_edit.rb
  var INTERVAL_PERIOD = 10000;
  var STATUS_STALE = "stale";
  var STATUS_OTHER_EDITORS = "opened_for_editing";

  var setupUpdateMonitor = function($form) {

    if ($form.data("update-monitor") === "enabled") {
      return;
    }

    $form.data("update-monitor", "enabled");

    var poll_url = $form.data("update-monitor-url");
    var lock_version = $form.data("update-monitor-lock_version");
    var uri = $form.data("update-monitor-record-uri");

    $(document).trigger("clearupdatemonitorintervals.aspace");

    var insertErrorAndHighlightSidebar = function(status_data) {
      // insert the error
      $(".record-pane .update-monitor-error", $form).remove(); // remove any existing errors
      if (status_data.status === STATUS_STALE) {
        var message = AS.renderTemplate("update_monitor_stale_record_message_template");
        $("#form_messages", $form).prepend(message);
        $(".record-pane .form-actions", $form).prepend(message);
        $(".btn-primary, .btn-toolbar .btn", $form).attr("disabled", "disabled").addClass("disabled");
      } else if (status_data.status === STATUS_OTHER_EDITORS) {
        var user_ids = [];
        $.each(status_data.edited_by, function(user_id, timestamp) {
          user_ids.push(user_id);
        });
        var message = AS.renderTemplate("update_monitor_other_editors_message_template", {user_ids: user_ids.join(", ")});
        $("#form_messages", $form).prepend(message);
        $(".record-pane .form-actions", $form).prepend(message);
      }

      // highlight in the sidebar
      if ($(".as-nav-list li.alert-error").length === 0) {
        $(".as-nav-list").prepend(AS.renderTemplate("as_nav_list_errors_item_template"));
      }
      var $errorNavListItem = $(".as-nav-list li.alert-error");

      if (!$errorNavListItem.hasClass("acknowledged") && $(document).data("UPDATE_MONITOR_HIGHLIGHT_INTERVAL") == null) {
        $(document).data("UPDATE_MONITOR_HIGHLIGHT_INTERVAL", setInterval(function() {
          $errorNavListItem.toggleClass("active");
        }, 3000));
        $errorNavListItem.hover(function() {
          clearInterval($(document).data("UPDATE_MONITOR_HIGHLIGHT_INTERVAL"));
          $errorNavListItem.removeClass("active").addClass("acknowledged");
        }, function() {});
      }
    };

    var clearAnyMonitorErrors = function() {
      $(".update-monitor-error", $form).remove();
    };

    var poll = function() {
      $.post(
        poll_url,
        {
          lock_version: lock_version,
          uri: uri
        },
        function(json, textStatus, jqXHR) {
          if (json.status === STATUS_STALE || json.status === STATUS_OTHER_EDITORS) {
            insertErrorAndHighlightSidebar(json)
          } else {
            // nobody else editing and lock_version still current
            clearAnyMonitorErrors()
          }
        },
        "json")
    };

    poll();
    $(document).data("UPDATE_MONITOR_POLLING_INTERVAL", setInterval(poll, INTERVAL_PERIOD));
  };


  $(document).bind("setupupdatemonitor.aspace", function(event, $form) {
    setupUpdateMonitor($form);
  });

  $(document).bind("clearupdatemonitorintervals.aspace", function(event) {
    clearInterval($(document).data("UPDATE_MONITOR_HIGHLIGHT_INTERVAL"));
    clearInterval($(document).data("UPDATE_MONITOR_POLLING_INTERVAL"));
  });
});
