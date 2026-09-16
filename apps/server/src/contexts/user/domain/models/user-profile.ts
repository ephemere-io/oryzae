export interface UserProfileProps {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  /** お知らせメールの配信停止 (Issue #614)。true = 受け取らない。 */
  newsletterOptOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export class UserProfile {
  readonly id: string;
  readonly nickname: string;
  readonly avatarUrl: string | null;
  readonly onboardingCompleted: boolean;
  readonly newsletterOptOut: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: UserProfileProps) {
    this.id = props.id;
    this.nickname = props.nickname;
    this.avatarUrl = props.avatarUrl;
    this.onboardingCompleted = props.onboardingCompleted;
    this.newsletterOptOut = props.newsletterOptOut;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static fromProps(props: UserProfileProps): UserProfile {
    return new UserProfile(props);
  }

  withOnboardingCompleted(): UserProfile {
    if (this.onboardingCompleted) return this;
    return new UserProfile({
      ...this.toProps(),
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): UserProfileProps {
    return {
      id: this.id,
      nickname: this.nickname,
      avatarUrl: this.avatarUrl,
      onboardingCompleted: this.onboardingCompleted,
      newsletterOptOut: this.newsletterOptOut,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
