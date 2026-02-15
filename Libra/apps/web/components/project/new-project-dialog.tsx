/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * new-project-dialog.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import type React from 'react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@libra/ui/components/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@libra/ui/components/input';
import { Label } from '@libra/ui/components/label';
import { toast } from 'sonner';
import * as m from '@/paraglide/messages';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Current project count
  currentProjectCount: number;
  // Callback for creating project
  onCreateProject: (name: string) => Promise<void>;
}

/**
 * New project dialog
 * Includes subscription limit checking
 */
export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ 
  isOpen, 
  onClose, 
  currentProjectCount,
  onCreateProject
}) => {
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  
  // Handle project creation
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error(m['dashboard.project_name_required']());
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Call the create project method
      await onCreateProject(projectName);
      
      toast.success(m['dashboard.project_create_success']());
      onClose();
    } catch (error) {
      toast.error(m['dashboard.create_failed']());
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m['dashboard.project_name_dialog_title']()}</DialogTitle>
          <DialogDescription>
            {m['dashboard.project_name_dialog_description']()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{m['dashboard.project_name_label']()}</Label>
            <Input 
              id="project-name"
              placeholder={m['dashboard.project_name_placeholder']()} 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          
          {/* Display project limit information */}
          {/*<div className="text-xs text-muted-foreground">*/}
          {/*  Current projects: {currentProjectCount} / {projectNums}*/}
          {/*</div>*/}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{m['dashboard.project_create_cancel']()}</Button>
          <Button 
            onClick={handleCreateProject} 
            disabled={isSubmitting || !projectName.trim()}
          >
            {isSubmitting ? m['dashboard.creating']() : m['dashboard.project_create_button']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 