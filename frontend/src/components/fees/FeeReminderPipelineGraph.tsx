import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export interface FeeCadenceStage {
  stageNumber: number;
  id: string;
  name: string;
  subtitle: string;
  timing: string;
  eventType: 'FEE_UPCOMING' | 'FEE_DUE' | 'FEE_OVERDUE' | 'PAYMENT_SUCCESS';
  isActive: boolean;
  templateTitle: string;
  templateBody: string;
  templatePreview: string;
  eligibleStudentsCount: number;
  queuedCount: number;
  badgeColor: 'emerald' | 'blue' | 'amber' | 'purple';
}

export const FeeReminderPipelineGraph: React.FC<{
  onTriggerSuccess?: () => void;
  className?: string;
}> = ({ onTriggerSuccess, className = '' }) => {
  const { toast } = useToast();
  const [stages, setStages] = useState<FeeCadenceStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPreviewStage, setExpandedPreviewStage] = useState<number | null>(null);
  const [triggeringStage, setTriggeringStage] = useState<string | null>(null);

  const fetchPipeline = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const res: any = await apiClient('/whatsapp/fee-cadence-pipeline');
      const data = Array.isArray(res) ? res : res?.data || [];
      if (Array.isArray(data) && data.length > 0) {
        setStages(data);
      }
    } catch (err: any) {
      console.warn('Failed to load fee cadence pipeline:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, []);

  const handleTriggerStage = async (stage: FeeCadenceStage) => {
    if (!window.confirm(`Trigger automated reminder dispatch for ${stage.name}? This will enqueue reminders for all currently eligible students.`)) {
      return;
    }

    try {
      setTriggeringStage(stage.id);
      const res: any = await apiClient('/whatsapp/remind/fee-cadence', {
        method: 'POST',
        body: JSON.stringify({ forceAllUnpaid: stage.eventType === 'FEE_OVERDUE' }),
      });

      toast.success(res?.message || `${stage.name} reminders dispatched successfully!`);
      await fetchPipeline(true);
      if (onTriggerSuccess) onTriggerSuccess();
    } catch (err: any) {
      console.error('Trigger failed:', err);
      toast.error(err.message || 'Failed to dispatch reminders');
    } finally {
      setTriggeringStage(null);
    }
  };

  const getStageIcon = (stageNumber: number) => {
    switch (stageNumber) {
      case 1:
        return <Calendar className="w-5 h-5 text-emerald-400" />;
      case 2:
        return <Clock className="w-5 h-5 text-blue-400" />;
      case 3:
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 4:
        return <CheckCircle2 className="w-5 h-5 text-purple-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getStageColorStyles = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          border: 'border-emerald-500/30 hover:border-emerald-500/60',
          badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          ring: 'ring-emerald-500/20',
          iconBg: 'bg-emerald-500/10 text-emerald-400',
        };
      case 'blue':
        return {
          border: 'border-blue-500/30 hover:border-blue-500/60',
          badge: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          ring: 'ring-blue-500/20',
          iconBg: 'bg-blue-500/10 text-blue-400',
        };
      case 'amber':
        return {
          border: 'border-amber-500/30 hover:border-amber-500/60',
          badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          ring: 'ring-amber-500/20',
          iconBg: 'bg-amber-500/10 text-amber-400',
        };
      case 'purple':
        return {
          border: 'border-purple-500/30 hover:border-purple-500/60',
          badge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
          ring: 'ring-purple-500/20',
          iconBg: 'bg-purple-500/10 text-purple-400',
        };
      default:
        return {
          border: 'border-slate-700 hover:border-slate-600',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          ring: 'ring-slate-500/20',
          iconBg: 'bg-slate-800 text-slate-300',
        };
    }
  };

  return (
    <Card className={`p-5 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl shadow-xl space-y-5 ${className}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Automated Fee Reminder Cadence Pipeline
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  4-Stage Active Flow
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visual timeline showing how &amp; when parents receive automated WhatsApp reminders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPipeline(true)}
            disabled={refreshing || loading}
            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Counts
          </Button>
        </div>
      </div>

      {/* Connected Flowchart Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        {stages.map((stage, idx) => {
          const styles = getStageColorStyles(stage.badgeColor);
          const isExpanded = expandedPreviewStage === stage.stageNumber;
          const isTriggering = triggeringStage === stage.id;

          return (
            <div key={stage.id} className="relative flex flex-col justify-between">
              {/* Connector Arrow (Desktop only, between stages 1-3) */}
              {idx < stages.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-10 z-10 w-6 h-6 items-center justify-center rounded-full bg-slate-950 border border-slate-700 text-slate-400 shadow-md">
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                </div>
              )}

              {/* Node Card */}
              <div
                className={`p-4 rounded-xl bg-slate-950/80 border transition-all duration-200 flex flex-col justify-between space-y-3.5 ${styles.border}`}
              >
                {/* Stage Header */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Stage {stage.stageNumber} of 4
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        stage.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {stage.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
                      {getStageIcon(stage.stageNumber)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 leading-tight">{stage.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{stage.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Timing Badge */}
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>Target Timing:</span>
                    <span className="text-indigo-400 font-mono text-[9px]">{stage.eventType}</span>
                  </div>
                  <p className="font-semibold text-slate-200 text-[11px]">{stage.timing}</p>
                </div>

                {/* Live Count Badges */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center">
                    <div className="text-xs font-extrabold text-slate-100 font-mono">
                      {stage.eligibleStudentsCount}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Eligible Today</div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center">
                    <div className="text-xs font-extrabold text-indigo-300 font-mono">
                      {stage.queuedCount}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">In Queue</div>
                  </div>
                </div>

                {/* Expand Template Preview Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedPreviewStage(isExpanded ? null : stage.stageNumber)}
                    className="w-full py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Template' : 'Preview Template'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-xl bg-[#0b141a] border border-[#222e35] text-[11px] text-slate-200 space-y-1 animate-in fade-in duration-200">
                      <div className="text-[9px] font-mono text-emerald-400 font-semibold mb-1 flex items-center justify-between">
                        <span>📱 WhatsApp Mockup</span>
                        <span>{stage.templateTitle}</span>
                      </div>
                      <div className="bg-[#005c4b] text-[#e9edef] p-2 rounded-lg text-[10.5px] leading-relaxed whitespace-pre-wrap font-sans">
                        {stage.templatePreview}
                        <div className="flex items-center justify-end gap-1 text-[9px] text-[#8696a0] mt-1">
                          <span>10:30 AM</span>
                          <span className="text-[#53bdeb]">✓✓</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Trigger action button (for stages 1, 2, 3) */}
                {stage.eventType !== 'PAYMENT_SUCCESS' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerStage(stage)}
                    disabled={isTriggering}
                    className="w-full text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
                  >
                    <Send className={`w-3 h-3 mr-1.5 ${isTriggering ? 'animate-spin' : ''}`} />
                    {isTriggering ? 'Dispatching...' : `Trigger Stage ${stage.stageNumber}`}
                  </Button>
                ) : (
                  <div className="py-1.5 text-center text-[10px] text-slate-400 italic">
                    ⚡ Auto-dispatches on payment receipt
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
