import { SkillSettingsPage } from "@/components/workspace/settings/skill-settings-page";
import {
  WorkspaceBody,
  WorkspaceContainer,
  WorkspaceHeader,
} from "@/components/workspace/workspace-container";

export default function SkillsPage() {
  return (
    <WorkspaceContainer>
      <WorkspaceHeader />
      <WorkspaceBody>
        <div className="mx-auto flex size-full max-w-(--container-width-md) flex-col px-4 py-6 lg:px-6">
          <div className="rounded-md border border-primary/15 bg-card/88 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-6">
            <SkillSettingsPage />
          </div>
        </div>
      </WorkspaceBody>
    </WorkspaceContainer>
  );
}
