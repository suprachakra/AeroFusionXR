import yaml

def test_prompts_load():
    data = yaml.safe_load(open("prompts/test_prompts.yaml"))
    assert isinstance(data, list)
