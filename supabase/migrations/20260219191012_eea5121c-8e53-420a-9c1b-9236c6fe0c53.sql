-- Create the trigger on auth.users to link pending letters on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_pending_letters();